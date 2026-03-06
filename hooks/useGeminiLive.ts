
import { useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { encodeBase64 } from '../utils/audioUtils';
import { telemetry } from '../services/telemetryService';

// ─── Tool Declaration ───────────────────────────────────────────
const provideFeedbackTool: FunctionDeclaration = {
    name: 'provide_feedback',
    parameters: {
        type: Type.OBJECT,
        description: 'Provide linguistic feedback to the student including corrections and pronunciation tips.',
        properties: {
            correction: { type: Type.STRING, description: 'The corrected English sentence if the user made a mistake.' },
            kannada_guide: { type: Type.STRING, description: 'A brief explanation in Kannada.' },
            pronunciation_tip: { type: Type.STRING, description: 'A phonetic tip for words the user struggled with.' }
        }
    }
};

// ─── Types ──────────────────────────────────────────────────────
export interface FeedbackData {
    correction?: string;
    kannadaGuide?: string;
    pronunciationTip?: string;
}

export interface UseGeminiLiveCallbacks {
    onAudioChunk: (base64: string) => void;
    onTranscription: (type: 'input' | 'output', text: string) => void;
    onTurnComplete: (userText: string, coachText: string, feedback: FeedbackData) => void;
    onInterrupted: () => void;
}

export interface UseGeminiLiveReturn {
    connect: (systemInstruction: string, voiceName: string) => Promise<void>;
    disconnect: () => void;
    sendPcmData: (pcmBytes: Uint8Array) => void;
    isConnected: boolean;
    isConnecting: boolean;
    isReconnecting: boolean;
    error: string | null;
    clearError: () => void;
}

// ─── Hook ───────────────────────────────────────────────────────
export function useGeminiLive(callbacks: UseGeminiLiveCallbacks): UseGeminiLiveReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sessionRef = useRef<any>(null);
    const activeIdRef = useRef<number>(0);
    const userInitiatedCloseRef = useRef(false);

    // Transcription buffers — accumulated per turn, flushed on turnComplete
    const inputBuf = useRef('');
    const outputBuf = useRef('');
    const feedbackBuf = useRef<FeedbackData>({});

    // Store last config for reconnection
    const lastConfigRef = useRef<{ instruction: string; voice: string } | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const MAX_RECONNECTS = 3;
    const sessionStartTimeRef = useRef<number | null>(null);

    const clearError = useCallback(() => setError(null), []);

    const connect = useCallback(async (systemInstruction: string, voiceName: string) => {
        // Prevent double-connect
        if (sessionRef.current) return;

        setIsConnecting(true);
        setError(null);
        userInitiatedCloseRef.current = false;
        lastConfigRef.current = { instruction: systemInstruction, voice: voiceName };

        const connectionId = Date.now();
        activeIdRef.current = connectionId;

        try {
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-latest',
                callbacks: {
                    onopen: () => {
                        setIsConnected(true);
                        setIsConnecting(false);
                        setIsReconnecting(false);
                        reconnectAttemptsRef.current = 0;
                        sessionStartTimeRef.current = Date.now();
                    },

                    onmessage: async (message: LiveServerMessage) => {
                        // ── Tool Calls ──
                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                if (fc.name === 'provide_feedback') {
                                    const args = fc.args as any;
                                    feedbackBuf.current = {
                                        correction: args.correction,
                                        kannadaGuide: args.kannada_guide,
                                        pronunciationTip: args.pronunciation_tip,
                                    };
                                    sessionPromise.then(s => s.sendToolResponse({
                                        functionResponses: { id: fc.id, name: fc.name, response: { status: 'logged' } },
                                    }));
                                }
                            }
                        }

                        // ── Transcriptions ──
                        const sanitize = (t: string) => t.replace(/<ctrl\d+>/g, '');
                        if (message.serverContent?.outputTranscription) {
                            const chunk = sanitize(message.serverContent.outputTranscription.text);
                            outputBuf.current += chunk;
                            callbacks.onTranscription('output', chunk);
                        } else if (message.serverContent?.inputTranscription) {
                            const chunk = sanitize(message.serverContent.inputTranscription.text);
                            inputBuf.current += chunk;
                            callbacks.onTranscription('input', chunk);
                        }

                        // ── Turn Complete ──
                        if (message.serverContent?.turnComplete) {
                            const userText = inputBuf.current.trim();
                            const coachText = outputBuf.current.trim();
                            callbacks.onTurnComplete(userText, coachText, { ...feedbackBuf.current });
                            inputBuf.current = '';
                            outputBuf.current = '';
                            feedbackBuf.current = {};
                        }

                        // ── Audio Chunks ──
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio) {
                            callbacks.onAudioChunk(base64Audio);
                        }

                        // ── Interruption ──
                        if (message.serverContent?.interrupted) {
                            callbacks.onInterrupted();
                        }
                    },

                    onerror: (e: any) => {
                        console.error('Live Error:', e);
                        if (activeIdRef.current !== connectionId) return;

                        const msg = e?.message?.includes('Requested entity was not found')
                            ? 'API Key error. Please check your Gemini API key.'
                            : 'Connection failed. Please check your internet and try again.';
                        setError(msg);
                        cleanupInternal();
                    },

                    onclose: () => {
                        console.log('Gemini Session Closed');
                        if (activeIdRef.current !== connectionId) return;

                        cleanupInternal();

                        // Auto-reconnect if user didn't initiate the close
                        if (!userInitiatedCloseRef.current && lastConfigRef.current && reconnectAttemptsRef.current < MAX_RECONNECTS) {
                            attemptReconnect();
                        }
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations: [provideFeedbackTool] }],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
                    },
                    systemInstruction,
                },
            });

            sessionRef.current = await sessionPromise;
        } catch (err: any) {
            console.error('Session start error:', err);
            setError('Failed to start conversation. Please check your internet and API key.');
            setIsConnecting(false);
            setIsReconnecting(false);
        }
    }, [callbacks]);

    const cleanupInternal = useCallback(() => {
        // Log duration before clearing
        if (sessionStartTimeRef.current) {
            const durationSeconds = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);
            if (durationSeconds > 0) {
                telemetry.logUsage({
                    api_type: 'voice',
                    model_name: 'gemini-live',
                    total_units: durationSeconds
                });
            }
            sessionStartTimeRef.current = null;
        }

        sessionRef.current = null;
        setIsConnected(false);
        setIsConnecting(false);
    }, []);

    const disconnect = useCallback(() => {
        userInitiatedCloseRef.current = true;
        reconnectAttemptsRef.current = MAX_RECONNECTS; // Prevent auto-reconnect
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) { console.debug('Error closing session:', e); }
            sessionRef.current = null;
        }
        setIsConnected(false);
        setIsConnecting(false);
        setIsReconnecting(false);
    }, []);

    const attemptReconnect = useCallback(async () => {
        if (!lastConfigRef.current) return;
        reconnectAttemptsRef.current += 1;
        const attempt = reconnectAttemptsRef.current;
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s

        console.log(`Reconnect attempt ${attempt}/${MAX_RECONNECTS} in ${delay}ms...`);
        setIsReconnecting(true);

        await new Promise(r => setTimeout(r, delay));

        // Check if user manually disconnected during the wait
        if (userInitiatedCloseRef.current) {
            setIsReconnecting(false);
            return;
        }

        try {
            await connect(lastConfigRef.current.instruction, lastConfigRef.current.voice);
        } catch {
            if (reconnectAttemptsRef.current >= MAX_RECONNECTS) {
                setError('Connection lost. Please try again.');
                setIsReconnecting(false);
            }
        }
    }, [connect]);

    const sendPcmData = useCallback((pcmBytes: Uint8Array) => {
        if (!sessionRef.current) return;
        try {
            sessionRef.current.sendRealtimeInput({
                media: {
                    data: encodeBase64(pcmBytes),
                    mimeType: 'audio/pcm;rate=16000',
                },
            });
        } catch (e) {
            console.debug('Failed to send PCM:', e);
        }
    }, []);

    return {
        connect,
        disconnect,
        sendPcmData,
        isConnected,
        isConnecting,
        isReconnecting,
        error,
        clearError,
    };
}
