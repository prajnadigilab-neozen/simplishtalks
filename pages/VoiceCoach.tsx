
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type, FunctionDeclaration } from '@google/genai';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import { CoachMessage } from '../types';
import { getUserSession } from '../services/authService';
import { getChatHistory, saveChatMessage, clearUserChatHistory, deleteChatMessage } from '../services/coachService';
import { textToSpeech, getTTSQuotaStatus } from '../services/geminiService';
import { playPCM, AudioStore } from '../utils/audioUtils';

// Internal decoding functions
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

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

const VoiceCoach: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAiTalking, setIsAiTalking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // History states
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [playingTipId, setPlayingTipId] = useState<string | null>(null);

  const nextStartTimeRef = useRef(0);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const historyScrollRef = useRef<HTMLDivElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Buffer for transcriptions during a turn
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const currentFeedback = useRef<{ correction?: string, kannadaGuide?: string, pronunciationTip?: string }>({});

  // Visualizer states
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      setLoadingHistory(true);
      const session = await getUserSession();
      if (session) {
        setUserId(session.id);
        const history = await getChatHistory(session.id);
        setMessages(history);
      }
      setLoadingHistory(false);
    };
    loadData();

    return cleanup;
  }, []);

  useEffect(() => {
    if (historyScrollRef.current) {
      historyScrollRef.current.scrollTop = historyScrollRef.current.scrollHeight;
    }
  }, [messages]);



  const handleCancel = () => {
    cleanup();
    navigate('/dashboard');
  };

  const stopAllAudio = () => {
    for (const source of sourcesRef.current) {
      try { source.stop(); } catch (e) { console.debug('Error stopping source:', e); }
    }
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const handleClearHistory = async () => {
    const confirmText = t({ en: "Are you sure you want to hide your session history?", kn: "ನಿಮ್ಮ ಸಂಭಾಷಣೆಯ ಹಿಸ್ಟರಿಯನ್ನು ಮರೆಮಾಡಲು ನೀವು ಖಚಿತವಾಗಿದ್ದೀರಾ?" });
    if (!userId || !window.confirm(confirmText)) return;
    await clearUserChatHistory(userId);
    setMessages([]);
  };

  const handleDeleteMessage = async (msg: CoachMessage) => {
    if (!msg.dbId) return;
    await deleteChatMessage(msg.dbId);
    setMessages(prev => prev.filter(m => m.dbId !== msg.dbId));
  };

  const handleSpeakTip = async (tip: string, id: string) => {
    if (playingTipId || getTTSQuotaStatus()) return;
    setPlayingTipId(id);
    try {
      const text = `Pronunciation tip: ${tip}`;
      const audio = await textToSpeech(text);
      if (audio) await playPCM(audio, text);
    } catch (e) {
      console.error(e);
    } finally {
      setPlayingTipId(null);
    }
  };

  const startSession = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

      audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Construct dynamic system instruction with history context
      const lastContext = messages.slice(-5).map(m => `${m.role === 'user' ? 'Student' : 'Coach'}: ${m.text}`).join('\n');
      const baseInstruction = `
        You are Kore, a friendly English Coach for Kannada speakers. 
        Keep conversations simple and natural.
        If the user makes a significant mistake or mispronounces a word, call the 'provide_feedback' tool to provide correction and help.
        
        Help Guidelines (kannada_guide):
        Use this format: [Kannada Text] ([Transliterated Kannada]) followed by a new line with the English translation.
        Example: ನಿಮ್ಮದು ಯಾವ ಊರು? (Nimmadu yaava ooru?)\nWhich is your hometown?
      `;

      const finalInstruction = lastContext
        ? `${baseInstruction}\n\nPrevious Conversation Context for Reference:\n${lastContext}`
        : baseInstruction;

      const sessionPromise = ai.live.connect({
        model: 'gemini-flash-latest',
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);

            const startWorklet = async () => {
              if (!audioContextInRef.current) return;

              const ctx = audioContextInRef.current;
              await ctx.audioWorklet.addModule('/audio-processor.js');

              const source = ctx.createMediaStreamSource(stream);
              const workletNode = new AudioWorkletNode(ctx, 'voice-coach-processor');

              workletNode.port.onmessage = (event) => {
                if (event.data.type === 'volume') {
                  setVolume(event.data.volume);
                } else if (event.data.type === 'pcm') {
                  const pcmBlob: Blob = {
                    data: encode(new Uint8Array(event.data.data)),
                    mimeType: 'audio/pcm;rate=16000',
                  };

                  sessionPromise.then((session) => {
                    session.sendRealtimeInput({ media: pcmBlob });
                  });
                }
              };

              source.connect(workletNode);
              workletNode.connect(ctx.destination);
            };

            startWorklet().catch(e => console.error("Worklet Start Error:", e));
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle tool calls
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'provide_feedback') {
                  const args = fc.args as any;
                  currentFeedback.current = {
                    correction: args.correction,
                    kannadaGuide: args.kannada_guide,
                    pronunciationTip: args.pronunciation_tip
                  };
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { status: 'logged' } }
                  }));
                }
              }
            }

            // Handle Transcriptions
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }

            // Handle turn completion and persistence
            if (message.serverContent?.turnComplete) {
              const userText = currentInputTranscription.current.trim();
              const coachText = currentOutputTranscription.current.trim();
              const feedback = currentFeedback.current;

              if (userId) {
                if (userText) {
                  const userMsg: CoachMessage = { role: 'user', text: userText, timestamp: Date.now() };
                  const dbId = await saveChatMessage(userId, userMsg);
                  if (dbId) userMsg.dbId = dbId;
                  setMessages(prev => [...prev, userMsg]);
                }
                if (coachText) {
                  const coachMsg: CoachMessage = {
                    role: 'coach',
                    text: coachText,
                    correction: feedback.correction,
                    kannadaGuide: feedback.kannadaGuide,
                    pronunciationTip: feedback.pronunciationTip,
                    timestamp: Date.now()
                  };
                  const dbId = await saveChatMessage(userId, coachMsg);
                  if (dbId) coachMsg.dbId = dbId;
                  setMessages(prev => [...prev, coachMsg]);
                }
              }

              // Reset buffers
              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
              currentFeedback.current = {};
            }

            // Handle Audio
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsAiTalking(true);
              const outCtx = audioContextOutRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);

              const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);

              // Analyser for visuals
              if (!analyserRef.current) {
                analyserRef.current = outCtx.createAnalyser();
                analyserRef.current.fftSize = 256;
                analyserRef.current.connect(outCtx.destination);
              }

              const source = outCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(analyserRef.current);

              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                  setIsAiTalking(false);
                  setVolume(0);
                }
              };

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);

              // Update visuals loop
              const updateAiVolume = () => {
                if (!analyserRef.current || sourcesRef.current.size === 0) return;
                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteTimeDomainData(dataArray);

                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  const val = (dataArray[i] - 128) / 128; // Normalize to -1..1
                  sum += val * val;
                }
                setVolume(Math.sqrt(sum / dataArray.length));

                if (sourcesRef.current.size > 0) requestAnimationFrame(updateAiVolume);
              };
              updateAiVolume();
            }

            if (message.serverContent?.interrupted) {
              stopAllAudio();
              setIsAiTalking(false);
            }
          },
          onerror: (e: any) => {
            console.error('Live Error:', e);
            if (e?.message?.includes('Requested entity was not found')) {
              setError('API Key error. Please re-select your key.');
              setShowKeyModal(true);
            } else {
              setError('Connection failed. Please ensure you have a valid paid API key and try again.');
            }
            cleanup();
          },
          onclose: () => {
            setIsConnected(false);
            setIsConnecting(false);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: [provideFeedbackTool] }],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: finalInstruction,
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error('Session start error:', err);
      setError('Failed to start conversation. Please check your internet and API key.');
      setIsConnecting(false);
    }
  };

  const cleanup = () => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) { console.debug('Error closing session:', e); }
    }
    stopAllAudio();
    setIsConnected(false);
    setIsConnecting(false);
    setIsAiTalking(false);
    setVolume(0);

    if (audioContextInRef.current) audioContextInRef.current.close();
    if (audioContextOutRef.current) audioContextOutRef.current.close();
  };

  return (
    <div className="flex flex-col h-full bg-blue-900 dark:bg-slate-950 text-white transition-colors overflow-hidden relative">


      {/* Top Navigation */}
      <div className="p-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <button onClick={handleCancel} className="p-2 text-white/70 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="font-black text-xs uppercase tracking-[0.3em]">{t(TRANSLATIONS.liveTalk)}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-[10px] font-bold text-white/50 uppercase">{isConnected ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        <button
          onClick={handleClearHistory}
          className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-full"
          title="Clear session history"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 6.65m-2.86 0L11.26 9m4.105-3.04a.5.5 0 0 1 .124-.128A48.543 48.543 0 0 0 16.5 4.5h-9a48.543 48.543 0 0 0-1.011 1.432.5.5 0 0 1-.124.128M15.5 12.5a.5.5 0 0 1 .5.5v2.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-2.5a.5.5 0 0 1 .5-.5h7Z" />
          </svg>
        </button>
      </div>

      {/* Main Experience */}
      <div className="flex-1 flex flex-col items-center overflow-hidden">
        {/* History Area - NOW VISIBLE BEFORE CONNECTION */}
        <div
          ref={historyScrollRef}
          className="w-full flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar-hidden bg-black/10 shadow-inner"
        >
          {loadingHistory && (
            <div className="flex flex-col items-center py-20 opacity-30">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
              <p className="font-black text-[10px] uppercase tracking-widest">Loading History...</p>
            </div>
          )}
          {!loadingHistory && messages.length === 0 && (
            <p className="text-center py-20 text-white/20 font-black uppercase text-[10px] tracking-widest">Session history will appear here</p>
          )}
          {!loadingHistory && messages.map((m, idx) => (
            <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 group/msg`}>
              <div className={`relative max-w-[85%] p-4 rounded-3xl shadow-sm ${m.role === 'user'
                ? 'bg-blue-600/30 border border-blue-400/20 text-white rounded-tr-none'
                : 'bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-tl-none'
                }`}>
                <div className="flex justify-between items-start gap-4">
                  <p className="font-bold text-sm leading-relaxed flex-1">{m.text}</p>
                  {m.dbId && (
                    <button
                      onClick={() => handleDeleteMessage(m)}
                      className="opacity-100 md:opacity-0 group-hover/msg:opacity-100 p-1.5 text-red-400/60 hover:text-red-500 transition-all rounded-lg"
                      title="Delete message"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 6.65m-2.86 0L11.26 9m4.105-3.04a.5.5 0 0 1 .124-.128A48.543 48.543 0 0 0 16.5 4.5h-9a48.543 48.543 0 0 0-1.011 1.432.5.5 0 0 1-.124.128M15.5 12.5a.5.5 0 0 1 .5.5v2.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-2.5a.5.5 0 0 1 .5-.5h7Z" />
                      </svg>
                    </button>
                  )}
                </div>

                {m.role === 'coach' && (m.correction || m.kannadaGuide || m.pronunciationTip) && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    {m.correction && (
                      <p className="text-[11px] font-bold text-amber-400 italic">Correction: {m.correction}</p>
                    )}
                    {m.kannadaGuide && (
                      <div className="bg-white/5 p-3 rounded-2xl">
                        <p className="text-[10px] text-blue-400 font-black uppercase tracking-tighter mb-1">
                          {t({ en: 'ಸಹಾಯ (Help)', kn: 'ಸಹಾಯ (Help)' })}
                        </p>
                        <p className="text-[11px] font-medium text-blue-300 whitespace-pre-line leading-relaxed">
                          {m.kannadaGuide}
                        </p>
                      </div>
                    )}
                    {m.pronunciationTip && (
                      <div className="flex justify-between items-center gap-2 bg-white/5 p-2 rounded-xl">
                        <p className="text-[10px] text-green-400 font-black flex-1">Tip: {m.pronunciationTip}</p>
                        <button
                          onClick={() => handleSpeakTip(m.pronunciationTip!, `tip-${idx}`)}
                          className={`p-1.5 rounded-lg transition-all ${playingTipId === `tip-${idx}` ? 'bg-green-600 animate-pulse' : 'bg-white/10 text-white/60 hover:text-white'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="w-full flex flex-col items-center justify-center p-8 space-y-8 relative shrink-0">
          <div className="relative">
            {isConnected && (
              <>
                <div
                  className={`absolute inset-0 bg-blue-400/20 rounded-full transition-transform duration-300 blur-2xl ${isAiTalking ? 'scale-[2.5] animate-pulse' : 'scale-[1.5]'}`}
                ></div>
                <div
                  className={`absolute inset-0 bg-orange-400/10 rounded-full transition-transform duration-500 blur-3xl ${volume > 0.1 ? 'scale-[3] opacity-50' : 'scale-0'}`}
                ></div>
              </>
            )}

            <div className={`w-32 h-32 md:w-48 md:h-48 rounded-full flex items-center justify-center transition-all duration-500 z-10 relative overflow-hidden border-4 border-white/20 ${isConnected ? 'bg-blue-600 shadow-[0_0_50px_rgba(37,99,235,0.5)] scale-110' : 'bg-slate-800 scale-90'}`}>
              {!isConnected ? (
                <span className="text-4xl">💤</span>
              ) : (
                <div className="flex items-end gap-1 h-12">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-white rounded-full transition-all duration-100"
                      style={{
                        height: isAiTalking
                          ? `${Math.random() * 100}%`
                          : isConnected && volume > 0.01
                            ? `${Math.min(100, volume * 1000 + (Math.random() * 20))}%`
                            : '4px'
                      }}
                    ></div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-center max-w-md w-full">
            {!isConnected && !isConnecting && (
              <div className="animate-in fade-in zoom-in">
                <h2 className="text-3xl font-black mb-4">{t({ en: 'Speak with Kore', kn: 'ಕೋರ್ ಜೊತೆ ಮಾತನಾಡಿ' })}</h2>
                <p className="text-white/60 font-bold mb-8 leading-relaxed text-sm">
                  {t({
                    en: 'Step into a private session. Practice naturally and improve your fluency instantly.',
                    kn: 'ಖಾಸಗಿ ಸಂಭಾಷಣೆ ನಡೆಸಿ. ಸಹಜವಾಗಿ ಮಾತನಾಡಿ ಮತ್ತು ನಿಮ್ಮ ಇಂಗ್ಲಿಷ್ ಅನ್ನು ಸುಧಾರಿಸಿ.'
                  })}
                </p>
                <button
                  onClick={startSession}
                  className="w-full bg-orange-500 text-white py-6 rounded-3xl font-black text-xl uppercase tracking-widest shadow-2xl hover:bg-orange-600 active:scale-95 transition-all border-b-8 border-orange-700"
                >
                  {t(TRANSLATIONS.startLearning)}
                </button>
              </div>
            )}

            {isConnecting && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                <p className="font-black text-sm uppercase tracking-widest text-white/70 animate-pulse">{t(TRANSLATIONS.connecting)}</p>
              </div>
            )}

            {isConnected && (
              <div className="flex items-center justify-center gap-8">
                <button
                  onClick={cleanup}
                  className="bg-red-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-red-500/30 hover:bg-red-600 active:scale-95 transition-all"
                >
                  {t(TRANSLATIONS.stopTalk)}
                </button>
              </div>
            )}

            {error && (
              <div className="mt-8 p-4 bg-red-500/20 border border-red-500 rounded-2xl text-red-200 text-sm font-bold animate-shake">
                {error}
                <button onClick={() => setError(null)} className="block mx-auto mt-2 underline opacity-50">Dismiss</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 overflow-hidden -z-10">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-blue-500 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-amber-500 rounded-full blur-[120px]"></div>
      </div>
    </div>
  );
};

export default VoiceCoach;
