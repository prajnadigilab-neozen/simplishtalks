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
    Timer
} from 'lucide-react';
import UsageCard from '../components/UsageCard';
import ProgressBar from '../components/ProgressBar';
import TrendChart from '../components/TrendChart';
import RegenerationModal from '../components/RegenerationModal';
import { APIStats, normalizeUsage, getProgressColor, calculateSpend } from '../utils/apiStatsUtils';
import { getUsageStatus } from '../utils/QuotaMiddleware';
import { supabase } from '../lib/supabase';

const fetchAPIStats = async (filters: { model: string; days: number }): Promise<APIStats & { total_spend: number }> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - filters.days);

    let query = supabase
        .from('api_usage')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

    if (filters.model !== 'all') {
        query = query.ilike('model_name', `%${filters.model}%`);
    }

    const { data: usageData, error } = await query;

    if (error) console.error("Error fetching usage data:", error);

    const trendMap: Record<string, { voice: number; chat: number }> = {};

    for (let i = filters.days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        trendMap[dateStr] = { voice: 0, chat: 0 };
    }

    let totalVoiceSeconds = 0;
    let totalChatTokens = 0;
    let totalSpend = 0;

    usageData?.forEach(row => {
        const dateStr = new Date(row.created_at).toISOString().split('T')[0];
        if (trendMap[dateStr]) {
            if (row.api_type === 'chat') {
                trendMap[dateStr].chat += row.total_units || 0;
                totalChatTokens += row.total_units || 0;
            } else {
                trendMap[dateStr].voice += row.total_units || 0;
                totalVoiceSeconds += row.total_units || 0;
            }
        }
        totalSpend += calculateSpend(row.model_name || 'default', row.input_units || 0, row.output_units || 0);
    });

    const trend_data = Object.entries(trendMap).map(([date, vals]) => ({
        date,
        voice: vals.voice,
        chat: vals.chat
    }));

    return {
        voice_usage: totalVoiceSeconds,
        chat_usage: totalChatTokens,
        total_spend: totalSpend,
        total_limit: 1000000,
        expiry_date: "2026-04-06",
        is_auto_renew: true,
        api_key: "sk_live_••••" + (userId ? userId.substring(0, 8) : "demo"),
        trend_data
    };
};

const APIAnalytics: React.FC = () => {
    const { t } = useLanguage();
    const [stats, setStats] = useState<APIStats & { total_spend: number } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [selectedModel, setSelectedModel] = useState<string>('all');
    const [days, setDays] = useState<number>(7);

    const fetchData = useCallback(async () => {
        const data = await fetchAPIStats({ model: selectedModel, days });
        setStats(data);
        setLastUpdated(new Date());
    }, [selectedModel, days]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // 10s is plenty for analytics
        return () => clearInterval(interval);
    }, [fetchData]);

    const quotaStatus = getUsageStatus(selectedModel === 'all' ? 'gemini-flash-latest' : selectedModel);

    if (!stats) return (
        <div className="flex h-screen items-center justify-center bg-slate-950">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
    );

    const totalUsage = normalizeUsage(stats.voice_usage, stats.chat_usage);
    const handleRegenerate = (type: 'temporal' | 'manual') => {
        console.log(`Key regenerated: ${type}`);
        setIsModalOpen(false);
        // Simulate update
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
                                onClick={() => setIsModalOpen(true)}
                                className="flex items-center space-x-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 active:scale-95 transition-all"
                            >
                                <RefreshCw className="h-4 w-4" />
                                <span>{t({ en: 'Rotate Key', kn: 'ಕೀ ಬದಲಿಸಿ' })}</span>
                            </button>
                        </div>
                    </div>

                    {/* Filters Row */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800">
                            {[7, 30, 90].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDays(d)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${days === d ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {d}D
                                </button>
                            ))}
                        </div>

                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="bg-slate-900 text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="all">ALL MODELS</option>
                            <option value="gemini-flash-latest">GEMINI FLASH LATEST</option>
                            <option value="gemini-3-flash-preview">GEMINI 3.0 FLASH PREVIEW</option>
                            <option value="gemini-1.5-flash">GEMINI 1.5 FLASH</option>
                            <option value="gemini-1.5-pro">GEMINI 1.5 PRO</option>
                            <option value="gemini-2.0-flash-exp">GEMINI 2.0 FLASH</option>
                        </select>
                    </div>
                </header>

                <div className="p-8">
                    {/* Top Grid: Hero Stats */}
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                        {/* Main Spend Card */}
                        <div className="col-span-1 rounded-3xl bg-slate-900 p-8 shadow-2xl border border-slate-800 lg:col-span-2 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8">
                                <Zap className="h-12 w-12 opacity-10 group-hover:opacity-20 transition-opacity text-blue-500" />
                            </div>

                            <div className="relative z-10">
                                <h2 className="text-lg font-semibold text-slate-400">{t({ en: 'Estimated API Spend', kn: 'ಅಂದಾಜು API ವೆಚ್ಚ' })}</h2>
                                <div className="mt-4 flex items-baseline space-x-3">
                                    <span className="text-5xl font-black text-white">${stats.total_spend.toFixed(2)}</span>
                                    <span className="text-xl font-medium text-slate-500">USD</span>
                                </div>

                                <div className="mt-8 flex gap-8">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t({ en: 'Monthly Credit', kn: 'ಮಾಸಿಕ ಕ್ರೆಡಿಟ್' })}</p>
                                        <p className="text-lg font-bold text-white">$10.00</p>
                                    </div>
                                    <div className="space-y-1 text-center">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t({ en: 'Remaining', kn: 'ಬಾಕಿ' })}</p>
                                        <p className="text-lg font-bold text-emerald-400">${Math.max(0, 10 - stats.total_spend).toFixed(2)}</p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t({ en: 'Consumption', kn: 'ಬಳಕೆ' })}</p>
                                        <p className="text-lg font-bold text-blue-400">{((stats.total_spend / 10) * 100).toFixed(1)}%</p>
                                    </div>
                                </div>
                                <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-500 transition-all duration-1000" 
                                        style={{ width: `${Math.min(100, (stats.total_spend / 10) * 100)}%` }}
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

                    {/* Secondary Grid: Detailed API Usage */}
                    <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
                        <UsageCard
                            title={t({ en: 'Voice API Usage', kn: 'ಧ್ವನಿ API ಬಳಕೆ' })}
                            value={`${(stats.voice_usage / 60).toFixed(1)} ${t({ en: 'min', kn: 'ನಿಮಿಷ' })}`}
                            subValue={`${stats.voice_usage.toLocaleString()} ${t({ en: 'seconds total', kn: 'ಒಟ್ಟು ಸೆಕೆಂಡುಗಳು' })}`}
                            icon={Phone}
                            color="bg-indigo-500"
                            trend={{ value: 12, isUp: true }}
                        />
                        <UsageCard
                            title={t({ en: 'Chat API Usage', kn: 'ಚಾಟ್ API ಬಳಕೆ' })}
                            value={stats.chat_usage.toLocaleString()}
                            subValue={t({ en: 'Total tokens consumed', kn: 'ಒಟ್ಟು ಟೋಕನ್‌ಗಳ ಬಳಕೆ' })}
                            icon={MessageSquare}
                            color="bg-blue-500"
                            trend={{ value: 5, isUp: false }}
                        />
                    </div>

                    {/* Chart Section */}
                    <div className="mt-8">
                        <TrendChart data={stats.trend_data} />
                    </div>

                    {/* Bottom Alert/Key Section */}
                    <div className="mt-8 rounded-3xl bg-slate-900/50 border border-slate-800 p-8">
                        <div className="flex flex-col items-start justify-between space-y-6 sm:flex-row sm:items-center sm:space-y-0">
                            <div>
                                <h3 className="text-lg font-bold text-white tracking-tight">Active API Key</h3>
                                <p className="mt-1 font-mono text-sm text-slate-500">{stats.api_key}</p>
                            </div>
                            <div className="flex space-x-4">
                                <button className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-300 hover:bg-slate-800 transition-colors">
                                    {t({ en: 'Copy Key', kn: 'ಕೀ ನಕಲಿಸಿ' })}
                                </button>
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="rounded-xl bg-slate-800 px-6 py-3 font-semibold text-white hover:bg-slate-700 transition-colors"
                                >
                                    {t({ en: 'Regenerate', kn: 'ಮತ್ತೆ ರಚಿಸಿ' })}
                                </button>
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
