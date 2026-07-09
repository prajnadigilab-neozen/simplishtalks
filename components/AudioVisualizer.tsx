
import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
    analyser: AnalyserNode | null;
    isConnected: boolean;
    isAiTalking: boolean;
}

/**
 * Zero-rerender audio visualizer.
 * Uses direct DOM manipulation inside requestAnimationFrame
 * to avoid triggering React reconciliation at 60fps.
 */
const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyser, isConnected, isAiTalking }) => {
    const barsRef = useRef<(HTMLDivElement | null)[]>([]);
    const orbGlowRef = useRef<HTMLDivElement | null>(null);
    const micGlowRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        if (!analyser || !isConnected) {
            // Reset bars when disconnected
            barsRef.current.forEach(bar => {
                if (bar) bar.style.height = '4px';
            });
            return;
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const animate = () => {
            analyser.getByteTimeDomainData(dataArray);

            // Compute RMS volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const val = (dataArray[i] - 128) / 128;
                sum += val * val;
            }
            const rms = Math.sqrt(sum / dataArray.length);

            // Update bar heights directly
            barsRef.current.forEach((bar, i) => {
                if (!bar) return;
                const band = Math.floor(i * dataArray.length / 8);
                const val = (dataArray[band] - 128) / 128;
                const h = rms > 0.01 ? Math.max(4, Math.abs(val) * 100) : 4;
                bar.style.height = `${Math.min(100, h + (i % 2 === 0 ? 2 : 0))}%`;
            });

            // Update glow effects
            if (orbGlowRef.current) {
                const scale = isAiTalking ? 2.5 : 1.5;
                orbGlowRef.current.style.transform = `scale(${scale})`;
                orbGlowRef.current.style.opacity = isAiTalking ? '1' : '0.5';
            }
            if (micGlowRef.current) {
                const scale = rms > 0.1 ? 3 : 0;
                micGlowRef.current.style.transform = `scale(${scale})`;
                micGlowRef.current.style.opacity = rms > 0.1 ? '0.5' : '0';
            }

            rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [analyser, isConnected, isAiTalking]);

    return (
        <div className="relative">
            {isConnected && (
                <>
                    <div
                        ref={orbGlowRef}
                        className="absolute inset-0 bg-blue-400/20 rounded-full transition-transform duration-300 blur-2xl"
                        style={{ transform: 'scale(1.5)' }}
                    />
                    <div
                        ref={micGlowRef}
                        className="absolute inset-0 bg-orange-400/10 rounded-full transition-transform duration-500 blur-3xl"
                        style={{ transform: 'scale(0)', opacity: 0 }}
                    />
                </>
            )}

            <div className={`w-32 h-32 md:w-48 md:h-48 rounded-full flex items-center justify-center transition-all duration-500 z-10 relative overflow-hidden border-4 border-white/20 ${isConnected ? 'bg-blue-600 shadow-[0_0_50px_rgba(37,99,235,0.5)] scale-110' : 'bg-slate-800 scale-90'}`}>
                {!isConnected ? (
                    <span className="text-4xl">💤</span>
                ) : (
                    <div className="flex items-end gap-1 h-12">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={i}
                                ref={el => { barsRef.current[i] = el; }}
                                className="w-2 bg-white rounded-full transition-all duration-100"
                                style={{ height: '4px' }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AudioVisualizer;
