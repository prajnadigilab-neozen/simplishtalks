import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Zap, Info, Timer, CheckCircle, AlertTriangle, XCircle, Calendar, TrendingUp, Download } from 'lucide-react';
import { useLanguage } from '../components/LanguageContext';
import QuotaCard from '../components/QuotaCard';
import BillingWallet from '../components/BillingWallet';
import { getUsageStatus } from '../utils/QuotaMiddleware';
import { supabase } from '../lib/supabase';
import { calculateSpend } from '../utils/apiStatsUtils';

const MODELS = [
    { id: 'gemini-flash-latest', label: 'FLASH LATEST' },
    { id: 'gemini-3-flash-preview', label: 'FLASH (3.0 Preview)' },
    { id: 'gemini-1.5-flash', label: 'FLASH 1.5' },
    { id: 'gemini-1.5-pro', label: 'PRO 1.5' },
    { id: 'gemini-2.0-flash-exp', label: 'FLASH 2.0 (EXP)' },
];

const getSevenDaysAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
};

const getToday = () => {
    return new Date().toISOString().split('T')[0];
};

const QuotaDashboard: React.FC = () => {
    const { t } = useLanguage();
    const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
    const [status, setStatus] = useState(getUsageStatus(selectedModel));
    const [timeRemaining, setTimeRemaining] = useState('');

    // AI Pro Wallet Period Utilization States
    const [startDate, setStartDate] = useState(getSevenDaysAgo());
    const [endDate, setEndDate] = useState(getToday());
    const [walletUtilization, setWalletUtilization] = useState(0);
    const [dailyUtilization, setDailyUtilization] = useState<Array<{ date: string, spend: number }>>([]);
    const [loadingWallet, setLoadingWallet] = useState(false);

    const fetchWalletStats = useCallback(async () => {
        setLoadingWallet(true);
        try {
            const { data: usageData, error } = await supabase
                .from('api_usage')
                .select('created_at, model_name, input_units, output_units')
                .gte('created_at', `${startDate}T00:00:00.000Z`)
                .lte('created_at', `${endDate}T23:59:59.999Z`);

            if (error) throw error;

            // Group by day
            const dayMap: Record<string, number> = {};
            
            // Initialize all dates in the range with 0
            const startD = new Date(startDate);
            const endD = new Date(endDate);
            for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                dayMap[dateStr] = 0;
            }

            let total = 0;
            usageData?.forEach(row => {
                const dateStr = new Date(row.created_at).toISOString().split('T')[0];
                const cost = calculateSpend(row.model_name || 'default', row.input_units || 0, row.output_units || 0);
                total += cost;
                if (dayMap[dateStr] !== undefined) {
                    dayMap[dateStr] += cost;
                } else {
                    dayMap[dateStr] = cost;
                }
            });

            const dailyList = Object.entries(dayMap).map(([date, spend]) => ({
                date,
                spend
            })).sort((a, b) => b.date.localeCompare(a.date)); // Descending order

            setWalletUtilization(total);
            setDailyUtilization(dailyList);
        } catch (err) {
            console.error("Error fetching wallet stats:", err);
        } finally {
            setLoadingWallet(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchWalletStats();
    }, [fetchWalletStats]);

    const handleDownloadCSV = async () => {
        try {
            const { data: usageData, error } = await supabase
                .from('api_usage')
                .select('created_at, api_type, model_name, input_units, output_units, total_units, package_type, user_id')
                .gte('created_at', `${startDate}T00:00:00.000Z`)
                .lte('created_at', `${endDate}T23:59:59.999Z`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!usageData || usageData.length === 0) {
                alert("No usage data found for the selected date range.");
                return;
            }

            const headers = ['Timestamp', 'API Type', 'Model Name', 'Input Units/Tokens', 'Output Units/Tokens', 'Total Units', 'Package Type', 'User ID'];
            const csvContent = [
                headers.join(','),
                ...usageData.map(row => [
                    new Date(row.created_at).toISOString(),
                    row.api_type || '',
                    row.model_name || '',
                    row.input_units ?? 0,
                    row.output_units ?? 0,
                    row.total_units ?? 0,
                    row.package_type || '',
                    row.user_id || ''
                ].join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `simplish_usage_analytics_${startDate}_to_${endDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err: any) {
            console.error("Failed to download CSV:", err);
            alert(`Error downloading CSV: ${err.message}`);
        }
    };

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
        if (usagePercent >= 100) return { label: t({ en: 'Quota Exhausted', kn: 'ಕೋಟಾ ಮುಗಿದಿದೆ' }), color: 'text-red-500', icon: XCircle, bg: 'bg-red-500/10' };
        if (usagePercent >= 80) return { label: t({ en: 'Rate Limited / Cooling Down', kn: 'ವೇಗ ಮಿತಿ / ಕೂಲಿಂಗ್ ಡೌನ್' }), color: 'text-yellow-500', icon: AlertTriangle, bg: 'bg-yellow-500/10' };
        return { label: t({ en: 'Active', kn: 'ಸಕ್ರಿಯ' }), color: 'text-emerald-500', icon: CheckCircle, bg: 'bg-emerald-500/10' };
    };

    const validity = getValidity();

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans text-slate-200">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-white flex items-center">
                            <Shield className="mr-3 h-8 w-8 text-blue-500" /> {t({ en: 'API GUARDRAIL', kn: 'API ರಕ್ಷಣೆ' })}
                        </h1>
                        <p className="mt-2 text-slate-400 font-medium">{t({ en: 'Model-Specific Quotas & Real-Time Monitoring', kn: 'ಮಾದರಿ-ನಿರ್ದಿಷ್ಟ ಮಿತಿಗಳು ಮತ್ತು ನೈಜ-ಸಮಯದ ಮೇಲ್ವಿಚಾರಣೆ' })}</p>
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

                {/* Billing & Wallet Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="lg:col-span-2">
                        <BillingWallet />
                    </div>
                    
                    {/* Period Utilization & Date Filters */}
                    <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8">
                            <Calendar className="h-12 w-12 opacity-10 group-hover:opacity-20 transition-opacity text-blue-500" />
                        </div>
                        
                        <div className="relative z-10 space-y-6">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Utilization Filter</span>
                                <h3 className="text-xl font-black text-white mt-1">Period Spend</h3>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Start Date</span>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        style={{ colorScheme: 'dark' }}
                                        className="bg-slate-950 text-slate-300 text-xs font-bold px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">End Date</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        style={{ colorScheme: 'dark' }}
                                        className="bg-slate-950 text-slate-300 text-xs font-bold px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                                    />
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-800">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Utilized in Period</span>
                                <div className="mt-2 flex items-baseline space-x-2">
                                    <span className="text-3xl font-black text-white">${walletUtilization.toFixed(3)}</span>
                                    <span className="text-sm font-medium text-slate-500">USD</span>
                                </div>
                                <p className="text-xs font-bold text-slate-400 mt-1">
                                    ~ ₹{(walletUtilization * 85.0).toFixed(2)} INR <span className="text-slate-600 font-medium">(at ₹85/$1)</span>
                                </p>
                                <button
                                    onClick={handleDownloadCSV}
                                    className="mt-4 w-full flex items-center justify-center space-x-2 rounded-xl bg-slate-950 border border-slate-850 px-4 py-2.5 text-xs font-bold text-slate-350 hover:bg-slate-800 hover:text-white transition-all active:scale-95"
                                >
                                    <Download className="h-4 w-4" />
                                    <span>{t({ en: 'Download Period CSV', kn: 'ವರದಿ ಡೌನ್‌ಲೋಡ್' })}</span>
                                </button>
                            </div>
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500">
                            <span>LIMIT CONSUMED</span>
                            <span className="text-blue-400">{((walletUtilization / 10.0) * 100).toFixed(2)}% of $10.00</span>
                        </div>
                    </div>
                </div>

                {/* Daily Wallet Utilization Breakdown */}
                <div className="mb-10 bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-500" />
                        Daily Wallet Utilization Breakdown
                    </h3>
                    
                    {loadingWallet ? (
                        <div className="flex py-10 justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                        </div>
                    ) : dailyUtilization.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 font-bold">
                            No utilization recorded for the selected period.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {dailyUtilization.map((day) => {
                                const maxDaySpend = Math.max(...dailyUtilization.map(d => d.spend), 0.01);
                                const percentage = (day.spend / maxDaySpend) * 100;
                                return (
                                    <div key={day.date} className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between text-xs font-bold mb-1.5">
                                                <span className="text-slate-300 font-mono">{day.date}</span>
                                                <span className="text-white">${day.spend.toFixed(3)} <span className="text-[10px] text-slate-500">(₹{(day.spend * 85.0).toFixed(2)})</span></span>
                                            </div>
                                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-blue-500 transition-all duration-500"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
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
                            <h3 className="text-xl font-black text-white italic">PRO TIP: GEMINI FLASH LATEST</h3>
                        </div>
                        <p className="text-slate-300 leading-relaxed font-medium">
                            For development and simple translation logic, use <span className="text-white font-bold">Gemini Flash Latest</span>.
                            It offers <span className="text-emerald-400 font-bold">6x higher daily limits</span> (1,500 RPD) while maintaining
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
