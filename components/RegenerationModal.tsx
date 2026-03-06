import React, { useState } from 'react';
import { Shield, Clock, RefreshCw, X } from 'lucide-react';

interface RegenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRegenerate: (type: 'temporal' | 'manual') => void;
}

const RegenerationModal: React.FC<RegenerationModalProps> = ({ isOpen, onClose, onRegenerate }) => {
    const [selectedType, setSelectedType] = useState<'temporal' | 'manual'>('temporal');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-md scale-in-center overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
                <div className="relative p-8">
                    <button
                        onClick={onClose}
                        className="absolute right-6 top-6 rounded-full p-2 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="flex flex-col items-center text-center">
                        <div className="mb-6 rounded-2xl bg-blue-500/10 p-4">
                            <Shield className="h-8 w-8 text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Regenerate API Key</h2>
                        <p className="mt-2 text-slate-400">
                            Select key type. Current session keys will be invalidated immediately.
                        </p>
                    </div>

                    <div className="mt-8 space-y-4">
                        <button
                            onClick={() => setSelectedType('temporal')}
                            className={`flex w-full items-center justify-between rounded-2xl border p-4 transition-all duration-200 ${selectedType === 'temporal'
                                    ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500'
                                    : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                                }`}
                        >
                            <div className="flex items-center space-x-4 text-left">
                                <div className={`rounded-xl p-2 ${selectedType === 'temporal' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                                    <Clock className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-white">Temporal Key</h4>
                                    <p className="text-xs text-slate-500">Auto-expires in 30 days. Most secure.</p>
                                </div>
                            </div>
                            <div className={`h-5 w-5 rounded-full border-2 ${selectedType === 'temporal' ? 'border-blue-500 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'border-slate-700'}`}>
                                {selectedType === 'temporal' && <div className="m-1 h-2 w-2 rounded-full bg-white" />}
                            </div>
                        </button>

                        <button
                            onClick={() => setSelectedType('manual')}
                            className={`flex w-full items-center justify-between rounded-2xl border p-4 transition-all duration-200 ${selectedType === 'manual'
                                    ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500'
                                    : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                                }`}
                        >
                            <div className="flex items-center space-x-4 text-left">
                                <div className={`rounded-xl p-2 ${selectedType === 'manual' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                                    <RefreshCw className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-white">Manual Key</h4>
                                    <p className="text-xs text-slate-500">Persistent until next manual rotation.</p>
                                </div>
                            </div>
                            <div className={`h-5 w-5 rounded-full border-2 ${selectedType === 'manual' ? 'border-blue-500 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'border-slate-700'}`}>
                                {selectedType === 'manual' && <div className="m-1 h-2 w-2 rounded-full bg-white" />}
                            </div>
                        </button>
                    </div>

                    <button
                        onClick={() => onRegenerate(selectedType)}
                        className="mt-8 w-full rounded-2xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 active:scale-95 transition-all"
                    >
                        Regenerate Now
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegenerationModal;
