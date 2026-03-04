/** V 1.0 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';

interface TelemetryRecord {
    id: string;
    tti: number | null;
    ect: string | null;
    downlink: number | null;
    rtt: number | null;
    zip_code: string | null;
    region: string | null;
    is_dropped: boolean;
    created_at: string;
}

const AdminTelemetry: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [data, setData] = useState<TelemetryRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTelemetry();
    }, []);

    const fetchTelemetry = async () => {
        setLoading(true);
        const { data: records, error } = await supabase
            .from('telemetry')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);

        if (!error && records) {
            setData(records);
        }
        setLoading(false);
    };

    const calculateStats = () => {
        const statsByRegion: Record<string, { ttiSum: number; count: number; drops: number }> = {};
        const ectDist: Record<string, number> = { '4g': 0, '3g': 0, '2g': 0, 'slow-2g': 0 };

        data.forEach(r => {
            const reg = r.region || 'Unknown';
            if (!statsByRegion[reg]) statsByRegion[reg] = { ttiSum: 0, count: 0, drops: 0 };

            if (r.tti) {
                statsByRegion[reg].ttiSum += r.tti;
                statsByRegion[reg].count += 1;
            }
            if (r.is_dropped) statsByRegion[reg].drops += 1;

            if (r.ect && ectDist[r.ect] !== undefined) {
                ectDist[r.ect] += 1;
            }
        });

        return { statsByRegion, ectDist };
    };

    const { statsByRegion, ectDist } = calculateStats();

    return (
        <div className="p-4 md:p-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-blue-900 dark:text-white uppercase tracking-tighter">Infrastructure Health</h1>
                    <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-1">Network Telemetry & TTI Monitoring</p>
                </div>
                <button
                    onClick={() => navigate('/admin')}
                    className="px-6 py-2 bg-white dark:bg-slate-900 text-blue-900 dark:text-white rounded-xl border-2 border-slate-100 dark:border-slate-800 font-black uppercase text-xs tracking-widest transition-all hover:bg-slate-50"
                >
                    Back
                </button>
            </div>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* TTI by Region */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                        <h2 className="text-xl font-black text-blue-900 dark:text-white mb-6 uppercase tracking-tighter">TTI by Region (ms)</h2>
                        <div className="space-y-4">
                            {Object.entries(statsByRegion).map(([region, stats]) => {
                                const avgTti = stats.count > 0 ? Math.round(stats.ttiSum / stats.count) : 0;
                                const barWidth = Math.min(100, (avgTti / 5000) * 100);
                                return (
                                    <div key={region}>
                                        <div className="flex justify-between text-xs font-black uppercase mb-1">
                                            <span className="text-slate-500">{region}</span>
                                            <span className={avgTti > 3000 ? 'text-red-500' : 'text-green-600'}>{avgTti}ms</span>
                                        </div>
                                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-1000 ${avgTti > 3000 ? 'bg-red-500' : 'bg-green-500'}`}
                                                style={{ width: `${barWidth}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Connection Quality */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                        <h2 className="text-xl font-black text-blue-900 dark:text-white mb-6 uppercase tracking-tighter">ECT Distribution</h2>
                        <div className="flex h-40 gap-4 items-end">
                            {Object.entries(ectDist).map(([type, count]) => {
                                const height = data.length > 0 ? (count / data.length) * 100 : 0;
                                return (
                                    <div key={type} className="flex-1 flex flex-col items-center gap-2">
                                        <div
                                            className="w-full bg-blue-500 dark:bg-blue-600 rounded-t-xl transition-all duration-1000"
                                            style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                                        ></div>
                                        <span className="text-[10px] font-black uppercase text-slate-400">{type}</span>
                                        <span className="text-[10px] font-black text-blue-900 dark:text-blue-200">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Drop Rates */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 lg:col-span-2">
                        <h2 className="text-xl font-black text-blue-900 dark:text-white mb-6 uppercase tracking-tighter">Connection Stability</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="pb-4 text-xs font-black uppercase text-slate-400">Region</th>
                                        <th className="pb-4 text-xs font-black uppercase text-slate-400">Samples</th>
                                        <th className="pb-4 text-xs font-black uppercase text-slate-400">Drops detected</th>
                                        <th className="pb-4 text-xs font-black uppercase text-slate-400">Reliability</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {Object.entries(statsByRegion).map(([region, stats]) => {
                                        const reliability = stats.count > 0 ? (((stats.count - stats.drops) / stats.count) * 100).toFixed(1) : '100';
                                        return (
                                            <tr key={region}>
                                                <td className="py-4 text-sm font-bold text-slate-800 dark:text-slate-200">{region}</td>
                                                <td className="py-4 text-sm font-bold text-slate-500">{stats.count}</td>
                                                <td className="py-4 text-sm font-bold text-red-500">{stats.drops}</td>
                                                <td className={`py-4 text-sm font-black ${Number(reliability) < 95 ? 'text-orange-500' : 'text-green-600'}`}>
                                                    {reliability}%
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTelemetry;
