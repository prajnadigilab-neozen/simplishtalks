
import { useRef, useState, useCallback } from 'react';
import { decodeBase64, decodeAudioData } from '../utils/audioUtils';

// ─── Types ──────────────────────────────────────────────────────
export interface UseAudioHardwareReturn {
    startMic: (onPcmData: (pcmBytes: Uint8Array) => void) => Promise<void>;
    stopMic: () => void;
    playAudioChunk: (base64: string) => Promise<void>;
    stopAllAudio: () => void;
    analyserNode: AnalyserNode | null;
    isAiTalking: boolean;
}

// ─── Hook ───────────────────────────────────────────────────────
export function useAudioHardware(): UseAudioHardwareReturn {
    const [isAiTalking, setIsAiTalking] = useState(false);

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

        workletNode.port.onmessage = (event) => {
            if (event.data.type === 'pcm') {
                onPcmData(new Uint8Array(event.data.data));
            }
            // Volume messages are ignored here — the visualizer reads from the analyser directly
        };

        source.connect(workletNode);
        workletNode.connect(ctx.destination);
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
        source.connect(analyserRef.current);

        source.onended = () => {
            sourcesRef.current.delete(source);
            if (sourcesRef.current.size === 0) {
                setIsAiTalking(false);
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
    }, []);

    return {
        startMic,
        stopMic,
        playAudioChunk,
        stopAllAudio,
        analyserNode: analyserRef.current,
        isAiTalking,
    };
}
