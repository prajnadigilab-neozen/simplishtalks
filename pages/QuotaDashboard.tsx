import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Zap, Info, Timer, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import QuotaCard from '../components/QuotaCard';
import BillingWallet from '../components/BillingWallet';
import { getUsageStatus } from '../utils/QuotaMiddleware';

const MODELS = [
    { id: 'gemini-1.5-flash', label: 'FLASH (1.5)' },
    { id: 'gemini-2.0-flash', label: 'FLASH (2.0)' },
    { id: 'gemini-2.0-pro', label: 'PRO (2.0)' },
];

const QuotaDashboard: React.FC = () => {
    const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
    const [status, setStatus] = useState(getUsageStatus(selectedModel));
    const [timeRemaining, setTimeRemaining] = useState('');

    const updateStatus = useCallback(() => {
        setStatus(getUsageStatus(selectedModel));
    }, [selectedModel]);

    useEffect(() => {
        updateStatus();
        const interval = setInterval(updateStatus, 5000);
        return () => clearInterval(interval);
    }, [updateStatus]);

    // Calculate Reset Timer (PT Midnight)
    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            const diff = status.resetTime - now;

            if (diff <= 0) {
                setTimeRemaining('RESETTING...');
            } else {
                const hours = Math.floor(diff / 3600000);
                const mins = Math.floor((diff % 3600000) / 60000);
                const secs = Math.floor((diff % 60000) / 1000);
                setTimeRemaining(`${hours}h ${mins}m ${secs}s`);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [status.resetTime]);

    const getValidity = () => {
        const usagePercent = (status.rpd / status.rpdLimit) * 100;
        if (usagePercent >= 100) return { label: 'Quota Exhausted', color: 'text-red-500', icon: XCircle, bg: 'bg-red-500/10' };
        if (usagePercent >= 80) return { label: 'Rate Limited / Cooling Down', color: 'text-yellow-500', icon: AlertTriangle, bg: 'bg-yellow-500/10' };
        return { label: 'Active', color: 'text-emerald-500', icon: CheckCircle, bg: 'bg-emerald-500/10' };
    };

    const validity = getValidity();

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans text-slate-200">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-white flex items-center">
                            <Shield className="mr-3 h-8 w-8 text-blue-500" /> API GUARDRAIL
                        </h1>
                        <p className="mt-2 text-slate-400 font-medium">Model-Specific Quotas & Real-Time Monitoring</p>
                    </div>

                    <div className="flex flex-col items-end">
                        <div className={`px-4 py-2 rounded-full flex items-center border border-current font-bold text-sm ${validity.color} ${validity.bg}`}>
                            <validity.icon className="mr-2 h-4 w-4" />
                            {validity.label.toUpperCase()}
                        </div>
                        <div className="mt-2 flex items-center text-slate-500 text-sm font-bold">
                            <Timer className="mr-2 h-4 w-4" /> RESET IN: <span className="ml-2 text-white tabular-nums">{timeRemaining}</span>
                        </div>
                    </div>
                </header>

                {/* Billing Wallet Integration */}
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <BillingWallet />
                </div>

                <div className="mb-8 flex flex-wrap gap-2 p-1 bg-slate-900/50 rounded-2xl w-fit border border-slate-800">
                    {MODELS.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setSelectedModel(m.id)}
                            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${selectedModel === m.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                {/* Hero Usage Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <QuotaCard
                        label="Daily Requests"
                        current={status.rpd}
                        limit={status.rpdLimit}
                        unit="RPD"
                        color="text-blue-500"
                    />
                    <QuotaCard
                        label="Tokens Per Minute"
                        current={status.tpm}
                        limit={status.tpmLimit}
                        unit="TPM"
                        color="text-purple-500"
                    />
                    <QuotaCard
                        label="Requests Per Minute"
                        current={status.rpm}
                        limit={status.rpmLimit}
                        unit="RPM"
                        color="text-amber-500"
                    />
                </div>

                {/* Tips & Testing Mode */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="p-8 bg-blue-600/10 rounded-3xl border border-blue-500/20">
                        <div className="flex items-center mb-4">
                            <Zap className="h-6 w-6 text-blue-400 mr-3" />
                            <h3 className="text-xl font-black text-white italic">PRO TIP: GEMINI 1.5 FLASH</h3>
                        </div>
                        <p className="text-slate-300 leading-relaxed font-medium">
                            For development and simple translation logic, use <span className="text-white font-bold">Gemini 1.5 Flash</span>.
                            It offers <span className="text-emerald-400 font-bold">4x higher daily limits</span> (1,000 RPD) while maintaining
                            near-parity for most SIMPLISH coaching tasks.
                        </p>
                    </div>

                    <div className="p-8 bg-slate-900/50 rounded-3xl border border-slate-800">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center">
                                <Info className="h-6 w-6 text-slate-400 mr-3" />
                                <h3 className="text-xl font-black text-white tracking-tight text-slate-300">TESTING GUARD</h3>
                            </div>
                            <div className={`px-3 py-1 rounded-lg text-xs font-black ${import.meta.env.VITE_TEST_MODE === 'true' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                                {import.meta.env.VITE_TEST_MODE === 'true' ? 'ACTIVE' : 'DISABLED'}
                            </div>
                        </div>
                        <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                            When <code className="bg-slate-800 px-1 py-0.5 rounded text-blue-400">VITE_TEST_MODE</code> is enabled, all API calls are intercepted.
                            The app returns local mock responses to save your production quota during UI development and unit testing.
                        </p>
                        <div className="flex items-center space-x-4">
                            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-1/3 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                            </div>
                            <span className="text-xs font-bold text-slate-500">OPTIMIZED VIA CONTEXT CACHING</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuotaDashboard;
