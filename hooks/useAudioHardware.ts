
import { useRef, useState, useCallback } from 'react';
import { decodeBase64, decodeRawPCM as decodeAudioData } from '../utils/audioUtils';

// ─── Types ──────────────────────────────────────────────────────
export interface UseAudioHardwareReturn {
    startMic: (onPcmData: (pcmBytes: Uint8Array) => void) => Promise<void>;
    stopMic: () => void;
    playAudioChunk: (base64: string) => Promise<void>;
    stopAllAudio: () => void;
    analyserNode: AnalyserNode | null;
    isAiTalking: boolean;
    recordingUrl: string | null;
    lastRecordingBlob: Blob | null;
    getLatestBlob: () => Blob | null;
}

// ─── Hook ───────────────────────────────────────────────────────
export function useAudioHardware(): UseAudioHardwareReturn {
    const [isAiTalking, setIsAiTalking] = useState(false);
    const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
    const [lastRecordingBlob, setLastRecordingBlob] = useState<Blob | null>(null);

    // Singleton AudioContexts — created once, resumed/suspended as needed
    const ctxInRef = useRef<AudioContext | null>(null);
    const ctxOutRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef(0);
    const workletLoadedRef = useRef(false);
    const isAiTalkingRef = useRef(false); // Used to gate mic during AI speech
    
    const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const latestBlobRef = useRef<Blob | null>(null);

    // ── Get or create singleton AudioContexts ──
    const getCtxIn = useCallback(() => {
        if (!ctxInRef.current || ctxInRef.current.state === 'closed') {
            ctxInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        }
        return ctxInRef.current;
    }, []);

    const getCtxOut = useCallback(() => {
        if (!ctxOutRef.current || ctxOutRef.current.state === 'closed') {
            ctxOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        return ctxOutRef.current;
    }, []);

    // ── Start Microphone ──
    const startMic = useCallback(async (onPcmData: (pcmBytes: Uint8Array) => void) => {
        const ctx = getCtxIn();
        if (ctx.state === 'suspended') await ctx.resume();

        // Ensure output context is also ready
        const outCtx = getCtxOut();
        if (outCtx.state === 'suspended') await outCtx.resume();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Microphone access is not supported in this browser or context (likely an insecure connection). Please use localhost or HTTPS.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Load worklet module once
        if (!workletLoadedRef.current) {
            await ctx.audioWorklet.addModule('/audio-processor.js');
            workletLoadedRef.current = true;
        }

        const source = ctx.createMediaStreamSource(stream);
        sourceNodeRef.current = source;

        const workletNode = new AudioWorkletNode(ctx, 'voice-coach-processor');
        workletNodeRef.current = workletNode;

        // ** Setup Recording Destination **
        if (!destNodeRef.current) {
            destNodeRef.current = outCtx.createMediaStreamDestination();
        }
        
        // Reset recording state
        recordedChunksRef.current = [];
        if (recordingUrl) {
            URL.revokeObjectURL(recordingUrl);
            setRecordingUrl(null);
        }

        // Start MediaRecorder
        try {
            const mr = new MediaRecorder(destNodeRef.current.stream);
            mr.ondataavailable = (e) => {
                if (e.data.size > 0) recordedChunksRef.current.push(e.data);
            };
            mr.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
                latestBlobRef.current = blob;
                setLastRecordingBlob(blob);
                setRecordingUrl(URL.createObjectURL(blob));
            };
            mr.start(1000); // chunk every second
            mediaRecorderRef.current = mr;
        } catch (err) {
            console.error("Failed to start MediaRecorder:", err);
        }

        // Connect mic directly to destination for recording (mixed with AI)
        // Note: outCtx is used for both AI playback and mixed recording
        const outSource = outCtx.createMediaStreamSource(stream);
        outSource.connect(destNodeRef.current);

        workletNode.port.onmessage = (event) => {
            if (event.data.type === 'pcm') {
                if (!isAiTalkingRef.current) {
                    onPcmData(new Uint8Array(event.data.data));
                }
            }
        };

        source.connect(workletNode);
        // NOTE: Do NOT connect workletNode to ctx.destination — that would route
        // mic audio to the speaker and cause an acoustic feedback loop.
    }, [getCtxIn, getCtxOut]);

    // ── Stop Microphone ──
    const stopMic = useCallback(() => {
        // Disconnect worklet
        if (workletNodeRef.current) {
            try { workletNodeRef.current.disconnect(); } catch (e) { /* noop */ }
            workletNodeRef.current = null;
        }
        if (sourceNodeRef.current) {
            try { sourceNodeRef.current.disconnect(); } catch (e) { /* noop */ }
            sourceNodeRef.current = null;
        }

        // Stop all media tracks
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        // Stop MediaRecorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try { mediaRecorderRef.current.stop(); } catch (e) { /* noop */ }
            mediaRecorderRef.current = null;
        }

        // Suspend (don't close) input context for reuse
        if (ctxInRef.current && ctxInRef.current.state === 'running') {
            ctxInRef.current.suspend().catch(() => { });
        }
    }, []);

    // ── Play Audio Chunk ──
    const playAudioChunk = useCallback(async (base64: string) => {
        const outCtx = getCtxOut();
        if (outCtx.state === 'suspended') await outCtx.resume();

        setIsAiTalking(true);
        isAiTalkingRef.current = true; // Gate mic while AI talks
        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);

        const audioBuffer = await decodeAudioData(decodeBase64(base64), outCtx, 24000, 1);

        // Lazy-create analyser
        if (!analyserRef.current) {
            analyserRef.current = outCtx.createAnalyser();
            analyserRef.current.fftSize = 256;
            analyserRef.current.connect(outCtx.destination);
        }

        const source = outCtx.createBufferSource();
        source.buffer = audioBuffer;
        
        // Connect to speaker AND recording destination
        source.connect(analyserRef.current);
        if (destNodeRef.current) {
            source.connect(destNodeRef.current);
        }

        source.onended = () => {
            sourcesRef.current.delete(source);
            if (sourcesRef.current.size === 0) {
                setIsAiTalking(false);
                isAiTalkingRef.current = false; // Re-enable mic
            }
        };

        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
        sourcesRef.current.add(source);
    }, [getCtxOut]);

    // ── Stop All Audio ──
    const stopAllAudio = useCallback(() => {
        for (const source of sourcesRef.current) {
            try { source.stop(); } catch (e) { /* noop */ }
        }
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        setIsAiTalking(false);
        isAiTalkingRef.current = false; // Always re-enable mic on explicit stop
    }, []);

    return {
        startMic,
        stopMic,
        playAudioChunk,
        stopAllAudio,
        analyserNode: analyserRef.current,
        isAiTalking,
        recordingUrl,
        lastRecordingBlob,
        getLatestBlob: () => latestBlobRef.current
    };
}
