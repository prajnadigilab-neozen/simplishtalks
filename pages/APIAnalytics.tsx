import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../components/LanguageContext';
import {
    Phone,
    MessageSquare,
    ShieldAlert,
    RefreshCw,
    LayoutDashboard,
    Settings,
    Menu,
    Zap,
    Timer,
    Database,
    TrendingUp,
    HelpCircle,
    Download
} from 'lucide-react';
import UsageCard from '../components/UsageCard';
import ProgressBar from '../components/ProgressBar';
import TrendChart from '../components/TrendChart';
import RegenerationModal from '../components/RegenerationModal';
import { APIStats, normalizeUsage, getProgressColor, calculateSpend } from '../utils/apiStatsUtils';
import { getUsageStatus } from '../utils/QuotaMiddleware';
import { supabase } from '../lib/supabase';

interface ExtendedAPIStats extends APIStats {
    talks_chat_usage: number;
    talks_voice_usage: number;
    talks_spend: number;
    snehi_spend: number;
    total_spend: number;
    day_stats: Array<{
        date: string;
        talksChat: number;
        talksVoice: number;
        snehiChat: number;
        snehiVoice: number;
        cost: number;
    }>;
}

const getSevenDaysAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
};

const getToday = () => {
    return new Date().toISOString().split('T')[0];
};

const fetchAPIStats = async (filters: { model: string; startDate: string; endDate: string }): Promise<ExtendedAPIStats> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    let query = supabase
        .from('api_usage')
        .select('*')
        .gte('created_at', `${filters.startDate}T00:00:00.000Z`)
        .lte('created_at', `${filters.endDate}T23:59:59.999Z`)
        .order('created_at', { ascending: true });

    if (filters.model !== 'all') {
        query = query.ilike('model_name', `%${filters.model}%`);
    }

    const { data: usageData, error } = await query;

    if (error) console.error("Error fetching usage data:", error);

    // Initialize trendMap for all dates in range
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    const trendMap: Record<string, { talksVoice: number; talksChat: number; snehiVoice: number; snehiChat: number; cost: number }> = {};

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        trendMap[dateStr] = { talksVoice: 0, talksChat: 0, snehiVoice: 0, snehiChat: 0, cost: 0 };
    }

    let totalSnehiVoiceSeconds = 0;
    let totalSnehiChatTokens = 0;
    let totalTalksVoiceSeconds = 0;
    let totalTalksChatTokens = 0;
    let totalTalksSpend = 0;
    let totalSnehiSpend = 0;
    let totalSpend = 0;

    usageData?.forEach(row => {
        const dateStr = new Date(row.created_at).toISOString().split('T')[0];
        const pkgType = row.package_type || (row.api_type === 'voice' ? 'SNEHI' : 'TALKS');
        const cost = calculateSpend(row.model_name || 'default', row.input_units || 0, row.output_units || 0);

        if (trendMap[dateStr]) {
            trendMap[dateStr].cost += cost;
            if (pkgType === 'TALKS') {
                if (row.api_type === 'chat') {
                    trendMap[dateStr].talksChat += row.total_units || 0;
                    totalTalksChatTokens += row.total_units || 0;
                } else if (row.api_type === 'voice') {
                    trendMap[dateStr].talksVoice += row.total_units || 0;
                    totalTalksVoiceSeconds += row.total_units || 0;
                }
            } else { // SNEHI
                if (row.api_type === 'chat') {
                    trendMap[dateStr].snehiChat += row.total_units || 0;
                    totalSnehiChatTokens += row.total_units || 0;
                } else if (row.api_type === 'voice') {
                    trendMap[dateStr].snehiVoice += row.total_units || 0;
                    totalSnehiVoiceSeconds += row.total_units || 0;
                }
            }
        }

        if (pkgType === 'TALKS') {
            totalTalksSpend += cost;
        } else {
            totalSnehiSpend += cost;
        }
        totalSpend += cost;
    });

    const trend_data = Object.entries(trendMap).map(([date, vals]) => ({
        date,
        talksChat: vals.talksChat,
        talksVoice: vals.talksVoice,
        snehiChat: vals.snehiChat,
        snehiVoice: vals.snehiVoice
    }));

    const day_stats = Object.entries(trendMap).map(([date, vals]) => ({
        date,
        talksChat: vals.talksChat,
        talksVoice: vals.talksVoice,
        snehiChat: vals.snehiChat,
        snehiVoice: vals.snehiVoice,
        cost: vals.cost
    })).sort((a, b) => b.date.localeCompare(a.date)); // descending date

    return {
        voice_usage: totalSnehiVoiceSeconds,
        chat_usage: totalSnehiChatTokens,
        talks_chat_usage: totalTalksChatTokens,
        talks_voice_usage: totalTalksVoiceSeconds,
        talks_spend: totalTalksSpend,
        snehi_spend: totalSnehiSpend,
        total_spend: totalSpend,
        total_limit: 1000000,
        expiry_date: "2026-04-06",
        is_auto_renew: true,
        api_key: "sk_live_••••" + (userId ? userId.substring(0, 8) : "demo"),
        trend_data,
        day_stats
    };
};

const APIAnalytics: React.FC = () => {
    const { t } = useLanguage();
    const [stats, setStats] = useState<ExtendedAPIStats | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [selectedModel, setSelectedModel] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>(getSevenDaysAgo());
    const [endDate, setEndDate] = useState<string>(getToday());
    const [exchangeRate, setExchangeRate] = useState<number>(85.0);

    const fetchData = useCallback(async () => {
        const data = await fetchAPIStats({ model: selectedModel, startDate, endDate });
        setStats(data);
        setLastUpdated(new Date());
    }, [selectedModel, startDate, endDate]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // 10s is plenty for analytics
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleDownloadCSV = async () => {
        try {
            let query = supabase
                .from('api_usage')
                .select('created_at, api_type, model_name, input_units, output_units, total_units, package_type, user_id')
                .gte('created_at', `${startDate}T00:00:00.000Z`)
                .lte('created_at', `${endDate}T23:59:59.999Z`)
                .order('created_at', { ascending: false });

            if (selectedModel !== 'all') {
                query = query.ilike('model_name', `%${selectedModel}%`);
            }

            const { data: usageData, error } = await query;

            if (error) throw error;

            if (!usageData || usageData.length === 0) {
                alert("No usage data found for the selected date range and model.");
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

    const quotaStatus = getUsageStatus(selectedModel === 'all' ? 'gemini-flash-latest' : selectedModel);

    if (!stats) return (
        <div className="flex h-screen items-center justify-center bg-slate-950">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
    );

    const handleRegenerate = (type: 'temporal' | 'manual') => {
        console.log(`Key regenerated: ${type}`);
        setIsModalOpen(false);
        fetchData();
    };

    return (
        <div className="flex h-screen overflow-hidden bg-slate-950 font-sans text-slate-200">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-slate-900 border-r border-slate-800 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex h-full flex-col">
                    <div className="flex items-center space-x-3 px-8 py-10">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20">
                            <ShieldAlert className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white">{t({ en: 'API Core', kn: 'API ಕೋರ್' })}</span>
                    </div>

                    <nav className="flex-1 space-y-2 px-4">
                        <button className="flex w-full items-center space-x-3 rounded-2xl bg-blue-500/10 px-4 py-4 text-blue-400">
                            <LayoutDashboard className="h-5 w-5" />
                            <span className="font-semibold">{t({ en: 'Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' })}</span>
                        </button>
                        <button className="flex w-full items-center space-x-3 rounded-2xl px-4 py-4 text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                            <Settings className="h-5 w-5" />
                            <span className="font-semibold">{t({ en: 'Settings', kn: 'ಸೆಟ್ಟಿಂಗ್ಸ್' })}</span>
                        </button>
                    </nav>

                    <div className="p-4">
                        <div className="rounded-2xl bg-slate-800/50 p-6 border border-slate-700/50">
                            <p className="text-sm font-medium text-slate-400">{t({ en: 'System Status', kn: 'ಸಿಸ್ಟಮ್ ಸ್ಥಿತಿ' })}</p>
                            <div className="mt-4 flex items-center space-x-2 text-emerald-400">
                                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-xs font-bold uppercase tracking-wider">{t({ en: 'All Systems Operational', kn: 'ಎಲ್ಲಾ ವ್ಯವಸ್ಥೆಗಳು ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತಿವೆ' })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
                <header className="flex flex-col border-b border-slate-800/50 bg-slate-950/50 px-8 py-4 backdrop-blur-md sticky top-0 z-30 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="rounded-xl bg-slate-900 p-2 text-slate-400 lg:hidden"
                            >
                                <Menu className="h-6 w-6" />
                            </button>
                            <h1 className="text-2xl font-bold text-white">{t({ en: 'Usage Analytics', kn: 'ಬಳಕೆ ವಿಶ್ಲೇಷಣೆ' })}</h1>
                        </div>

                        <div className="flex items-center space-x-6 text-sm">
                            <div className="hidden flex-col items-end sm:flex">
                                <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">{t({ en: 'Last Sync', kn: 'ಕೊನೆಯ ಸಿಂಕ್' })}</span>
                                <span className="font-semibold text-slate-300">{lastUpdated.toLocaleTimeString()}</span>
                            </div>
                            <button
                                onClick={handleDownloadCSV}
                                className="flex items-center space-x-2 rounded-xl bg-slate-900 border border-slate-850 px-5 py-3 font-bold text-slate-350 hover:bg-slate-800 hover:text-white active:scale-95 transition-all"
                            >
                                <Download className="h-4 w-4" />
                                <span>{t({ en: 'Download CSV', kn: 'ವರದಿ ಡೌನ್‌ಲೋಡ್' })}</span>
                            </button>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="flex items-center space-x-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 active:scale-95 transition-all"
                            >
                                <RefreshCw className="h-4 w-4" />
                                <span>{t({ en: 'Rotate Key', kn: 'ಕೀ ಬದಲಿಸಿ' })}</span>
                            </button>
                        </div>
                    </div>

                    {/* Filters Row */}
                    <div className="flex flex-wrap items-center gap-6 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60">
                        {/* Start Date */}
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t({ en: 'Start Date', kn: 'ಪ್ರಾರಂಭ ದಿನಾಂಕ' })}</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ colorScheme: 'dark' }}
                                className="bg-slate-950 text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                            />
                        </div>

                        {/* End Date */}
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t({ en: 'End Date', kn: 'ಕೊನೆಯ ದಿನಾಂಕ' })}</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ colorScheme: 'dark' }}
                                className="bg-slate-950 text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                            />
                        </div>

                        {/* Exchange Rate */}
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t({ en: 'Exchange Rate', kn: 'ವಿನಿಮಯ ದರ' })}</span>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">₹</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={exchangeRate}
                                    onChange={(e) => setExchangeRate(Math.max(0.1, parseFloat(e.target.value) || 1))}
                                    className="bg-slate-950 text-slate-300 text-xs font-bold pl-7 pr-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 transition-colors w-28"
                                />
                            </div>
                        </div>

                        {/* Model Select */}
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t({ en: 'Model', kn: 'ಮಾದರಿ' })}</span>
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="bg-slate-950 text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                            >
                                <option value="all">ALL MODELS</option>
                                <option value="gemini-flash-latest">GEMINI FLASH LATEST</option>
                                <option value="gemini-3-flash-preview">GEMINI 3.0 FLASH PREVIEW</option>
                                <option value="gemini-1.5-flash">GEMINI 1.5 FLASH</option>
                                <option value="gemini-1.5-pro">GEMINI 1.5 PRO</option>
                                <option value="gemini-2.0-flash-exp">GEMINI 2.0 FLASH</option>
                            </select>
                        </div>
                    </div>
                </header>

                <div className="p-8 space-y-8">
                    {/* Top Grid: Hero Stats */}
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                        {/* Talks Spend Card */}
                        <div className="col-span-1 rounded-3xl bg-slate-900 p-8 shadow-2xl border border-slate-800 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8">
                                <Zap className="h-12 w-12 opacity-10 group-hover:opacity-20 transition-opacity text-blue-500" />
                            </div>

                            <div className="relative z-10">
                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Talks API Key</span>
                                <h2 className="text-lg font-bold text-white mt-1">{t({ en: 'Talks API Spend', kn: 'Talks API ವೆಚ್ಚ' })}</h2>
                                <div className="mt-4 flex items-baseline space-x-2">
                                    <span className="text-4xl font-black text-white">₹{(stats.talks_spend * exchangeRate).toFixed(2)}</span>
                                    <span className="text-sm font-medium text-slate-500">INR</span>
                                </div>

                                <div className="mt-6 flex justify-between text-xs border-t border-slate-800/60 pt-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{t({ en: 'Credit', kn: 'ಕ್ರೆಡಿಟ್' })}</p>
                                        <p className="font-bold text-white">₹{(10.00 * exchangeRate).toFixed(2)}</p>
                                    </div>
                                    <div className="space-y-1 text-center">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{t({ en: 'Remaining', kn: 'ಬಾಕಿ' })}</p>
                                        <p className="font-bold text-emerald-400">₹{(Math.max(0, 10 - stats.talks_spend) * exchangeRate).toFixed(2)}</p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{t({ en: 'Usage', kn: 'ಬಳಕೆ' })}</p>
                                        <p className="font-bold text-blue-400">{((stats.talks_spend / 10) * 100).toFixed(1)}%</p>
                                    </div>
                                </div>
                                <div className="mt-4 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-500 transition-all duration-1000" 
                                        style={{ width: `${Math.min(100, (stats.talks_spend / 10) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Snehi Spend Card */}
                        <div className="col-span-1 rounded-3xl bg-slate-900 p-8 shadow-2xl border border-slate-800 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8">
                                <Zap className="h-12 w-12 opacity-10 group-hover:opacity-20 transition-opacity text-orange-500" />
                            </div>

                            <div className="relative z-10">
                                <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Snehi API Key</span>
                                <h2 className="text-lg font-bold text-white mt-1">{t({ en: 'Snehi API Spend', kn: 'Snehi API ವೆಚ್ಚ' })}</h2>
                                <div className="mt-4 flex items-baseline space-x-2">
                                    <span className="text-4xl font-black text-white">₹{(stats.snehi_spend * exchangeRate).toFixed(2)}</span>
                                    <span className="text-sm font-medium text-slate-500">INR</span>
                                </div>

                                <div className="mt-6 flex justify-between text-xs border-t border-slate-800/60 pt-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{t({ en: 'Credit', kn: 'ಕ್ರೆಡಿಟ್' })}</p>
                                        <p className="font-bold text-white">₹{(10.00 * exchangeRate).toFixed(2)}</p>
                                    </div>
                                    <div className="space-y-1 text-center">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{t({ en: 'Remaining', kn: 'ಬಾಕಿ' })}</p>
                                        <p className="font-bold text-emerald-400">₹{(Math.max(0, 10 - stats.snehi_spend) * exchangeRate).toFixed(2)}</p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{t({ en: 'Usage', kn: 'ಬಳಕೆ' })}</p>
                                        <p className="font-bold text-orange-400">{((stats.snehi_spend / 10) * 100).toFixed(1)}%</p>
                                    </div>
                                </div>
                                <div className="mt-4 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-orange-500 transition-all duration-1000" 
                                        style={{ width: `${Math.min(100, (stats.snehi_spend / 10) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Rate Limit Info Card */}
                        <div className="rounded-3xl bg-slate-900 p-8 shadow-2xl border border-slate-800 flex flex-col justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-400">Live Rate Limits</h2>
                                <div className="mt-6 space-y-6">
                                    <div>
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                                            <span>Tokens / Min</span>
                                            <span className="text-white">{quotaStatus.tpm.toLocaleString()} / {quotaStatus.tpmLimit.toLocaleString()}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full transition-all duration-500 ${quotaStatus.tpm / quotaStatus.tpmLimit > 0.8 ? 'bg-amber-500' : 'bg-purple-500'}`}
                                                style={{ width: `${(quotaStatus.tpm / quotaStatus.tpmLimit) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                                            <span>Requests / Min</span>
                                            <span className="text-white">{quotaStatus.rpm} / {quotaStatus.rpmLimit}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full transition-all duration-500 ${quotaStatus.rpm / quotaStatus.rpmLimit > 0.8 ? 'bg-amber-500' : 'bg-amber-400'}`}
                                                style={{ width: `${(quotaStatus.rpm / quotaStatus.rpmLimit) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center justify-between rounded-xl bg-blue-500/10 p-4 border border-blue-500/20">
                                <div className="flex items-center text-blue-400">
                                    <Timer className="h-4 w-4 mr-2" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Next Reset</span>
                                </div>
                                <span className="text-xs font-bold text-white tabular-nums">
                                    {new Date(quotaStatus.resetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* API Economics & Reference Rates Section */}
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                        {/* Talks Card */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-blue-400">TALKS Package Cost</h3>
                                    <span className="text-xs font-black bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full">₹299 / Month</span>
                                </div>
                                <div className="space-y-3 mt-4">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400">Chat usage (Tokens):</span>
                                        <span className="font-bold text-white">{stats.talks_chat_usage.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400">Pronunciation Check (Voice Mins):</span>
                                        <span className="font-bold text-white">{(stats.talks_voice_usage / 60).toFixed(1)} mins</span>
                                    </div>
                                    <div className="h-px bg-slate-800 my-2" />
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400 font-bold">API cost incurred:</span>
                                        <span className="font-bold text-blue-400">₹{(stats.talks_spend * exchangeRate).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-550 border-t border-slate-800 pt-4 mt-6">
                                Talks Package offers unlimited chat and pronunciation practice. Top-ups extend duration (+30 days for ₹99).
                            </div>
                        </div>

                        {/* Snehi Card */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-orange-400">SNEHI Package Cost</h3>
                                    <span className="text-xs font-black bg-orange-500/10 text-orange-400 px-2.5 py-1 rounded-full">₹499 / Month</span>
                                </div>
                                <div className="space-y-3 mt-4">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400">Scenario Practice (Tokens):</span>
                                        <span className="font-bold text-white">{stats.chat_usage.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400">Voice Coach (Voice Mins):</span>
                                        <span className="font-bold text-white">{(stats.voice_usage / 60).toFixed(1)} mins</span>
                                    </div>
                                    <div className="h-px bg-slate-800 my-2" />
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400 font-bold">API cost incurred:</span>
                                        <span className="font-bold text-orange-400">₹{(stats.snehi_spend * exchangeRate).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-550 border-t border-slate-800 pt-4 mt-6">
                                Snehi Package operates on voice credits. Top-ups add voice minutes (+60 mins for ₹99, ₹1.65/min).
                            </div>
                        </div>

                        {/* API Model Rates */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-purple-400">Gemini API Model Pricing</h3>
                                    <span className="text-xs font-black bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full">INR / 1M Tokens</span>
                                </div>
                                <div className="space-y-3 mt-4 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Gemini 3.0 Flash input:</span>
                                        <span className="font-bold text-white">₹{(0.000000075 * 1000000 * exchangeRate).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Gemini 3.0 Flash output:</span>
                                        <span className="font-bold text-white">₹{(0.0000003 * 1000000 * exchangeRate).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Gemini 1.5 Pro input:</span>
                                        <span className="font-bold text-white">₹{(0.00000125 * 1000000 * exchangeRate).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Gemini 1.5 Pro output:</span>
                                        <span className="font-bold text-white">₹{(0.000005 * 1000000 * exchangeRate).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-550 border-t border-slate-800 pt-4 mt-6">
                                Rates are calculated per one million tokens based on the current exchange rate input.
                            </div>
                        </div>
                    </div>

                    {/* Secondary Grid: Detailed API Usage */}
                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                        <UsageCard
                            title="TALKS Chat Usage"
                            value={stats.talks_chat_usage.toLocaleString()}
                            subValue={t({ en: 'Total tokens consumed', kn: 'ಒಟ್ಟು ಟೋಕನ್‌ಗಳ ಬಳಕೆ' })}
                            icon={MessageSquare}
                            color="bg-blue-500"
                            trend={{ value: 5, isUp: true }}
                        />
                        <UsageCard
                            title="TALKS Voice Usage"
                            value={`${(stats.talks_voice_usage / 60).toFixed(1)} min`}
                            subValue="Pronunciation check seconds"
                            icon={Phone}
                            color="bg-cyan-500"
                            trend={{ value: 8, isUp: true }}
                        />
                        <UsageCard
                            title="SNEHI Chat Usage"
                            value={stats.chat_usage.toLocaleString()}
                            subValue="Scenario practice tokens"
                            icon={MessageSquare}
                            color="bg-orange-500"
                            trend={{ value: 2, isUp: false }}
                        />
                        <UsageCard
                            title="SNEHI Voice Usage"
                            value={`${(stats.voice_usage / 60).toFixed(1)} min`}
                            subValue="Voice coach seconds"
                            icon={Phone}
                            color="bg-yellow-500"
                            trend={{ value: 15, isUp: true }}
                        />
                    </div>

                    {/* Chart Section */}
                    <div>
                        <TrendChart data={stats.trend_data} />
                    </div>

                    {/* Daily Breakdown Table */}
                    <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800 shadow-xl overflow-hidden">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                            Daily API Usage Breakdown
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        <th className="py-4 px-4">Date</th>
                                        <th className="py-4 px-4 text-blue-400">TALKS Chat (Tokens)</th>
                                        <th className="py-4 px-4 text-cyan-400">TALKS Voice (Seconds)</th>
                                        <th className="py-4 px-4 text-orange-400">SNEHI Chat (Tokens)</th>
                                        <th className="py-4 px-4 text-yellow-400">SNEHI Voice (Seconds)</th>
                                        <th className="py-4 px-4 text-right text-emerald-400">Daily Spend</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.day_stats.map((row, idx) => (
                                        <tr key={idx} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                                            <td className="py-4 px-4 font-mono font-medium text-slate-300">{row.date}</td>
                                            <td className="py-4 px-4 font-bold text-slate-100">{row.talksChat.toLocaleString()}</td>
                                            <td className="py-4 px-4 font-bold text-slate-100">{row.talksVoice.toLocaleString()}s</td>
                                            <td className="py-4 px-4 font-bold text-slate-100">{row.snehiChat.toLocaleString()}</td>
                                            <td className="py-4 px-4 font-bold text-slate-100">{row.snehiVoice.toLocaleString()}s</td>
                                            <td className="py-4 px-4 font-mono font-bold text-right text-emerald-400">₹{(row.cost * exchangeRate).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {stats.day_stats.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-slate-500 font-bold">
                                                No records found for the selected dates.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bottom Alert/Key Section */}
                    <div className="rounded-3xl bg-slate-900/50 border border-slate-800 p-8 shadow-xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col justify-between space-y-4 md:space-y-0">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Talks Package</span>
                                    <h3 className="text-base font-bold text-white tracking-tight mt-1">Talks API Key</h3>
                                    <p className="mt-1.5 font-mono text-xs text-slate-500">{"sk_talks_••••" + (stats.api_key.includes("demo") ? "demo" : stats.api_key.substring(stats.api_key.length - 8))}</p>
                                </div>
                                <div className="flex space-x-4 pt-4">
                                    <button 
                                        onClick={() => { navigator.clipboard.writeText("Talks Key Hidden"); alert("Talks Key placeholder copied to clipboard"); }} 
                                        className="rounded-xl border border-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                                    >
                                        {t({ en: 'Copy Key', kn: 'ಕೀ ನಕಲಿಸಿ' })}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex flex-col justify-between space-y-4 md:space-y-0 border-t border-slate-800/80 md:border-t-0 md:border-l md:border-slate-800/80 md:pl-8 pt-6 md:pt-0">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Snehi Package</span>
                                    <h3 className="text-base font-bold text-white tracking-tight mt-1">Snehi API Key</h3>
                                    <p className="mt-1.5 font-mono text-xs text-slate-500">{"sk_snehi_••••" + (stats.api_key.includes("demo") ? "demo" : stats.api_key.substring(stats.api_key.length - 8))}</p>
                                </div>
                                <div className="flex space-x-4 pt-4">
                                    <button 
                                        onClick={() => { navigator.clipboard.writeText("Snehi Key Hidden"); alert("Snehi Key placeholder copied to clipboard"); }} 
                                        className="rounded-xl border border-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                                    >
                                        {t({ en: 'Copy Key', kn: 'ಕೀ ನಕಲಿಸಿ' })}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <RegenerationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onRegenerate={handleRegenerate}
            />
        </div>
    );
};

export default APIAnalytics;
