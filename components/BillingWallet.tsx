
import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, AlertCircle, ShieldCheck } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { getCreditStatus, BillingStatus } from '../services/billingService';

const mockTrendData = [
    { day: 1, spend: 0.1 }, { day: 2, spend: 0.15 }, { day: 3, spend: 0.2 },
    { day: 4, spend: 0.18 }, { day: 5, spend: 0.25 }, { day: 6, spend: 0.3 },
    { day: 7, spend: 0.28 }, { day: 8, spend: 0.35 }, { day: 9, spend: 0.4 },
    { day: 10, spend: 0.45 }, { day: 11, spend: 0.5 }, { day: 12, spend: 0.48 }
];

const BillingWallet: React.FC = () => {
    const [status, setStatus] = useState<BillingStatus | null>(null);

    useEffect(() => {
        getCreditStatus().then(setStatus);
    }, []);

    if (!status) return null;

    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (status.credit_percentage / 100) * circumference;

    return (
        <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl relative overflow-hidden group">
            {/* Background Glow */}
            <div className={`absolute -top-24 -right-24 w-64 h-64 blur-[100px] opacity-20 pointer-events-none transition-colors ${status.remaining_credit < 2.0 ? 'bg-rose-500' : 'bg-blue-500'}`} />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">

                {/* Circular Progress */}
                <div className="relative flex items-center justify-center shrink-0">
                    <svg className="w-32 h-32 -rotate-90">
                        <circle
                            cx="64"
                            cy="64"
                            r={radius}
                            stroke="currentColor"
                            strokeWidth="6"
                            fill="transparent"
                            className="text-slate-800"
                        />
                        <circle
                            cx="64"
                            cy="64"
                            r={radius}
                            stroke="currentColor"
                            strokeWidth="10"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            className={`transition-all duration-1000 ease-out ${status.remaining_credit < 2.0 ? 'text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]'}`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-tighter">Credit</span>
                        <span className="text-xl font-black text-white">{Math.round(status.credit_percentage)}%</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Wallet className="w-4 h-4 text-blue-400" />
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">AI Pro Wallet</h3>
                            </div>
                            <p className="text-3xl font-black text-white">
                                ${status.remaining_credit.toFixed(2)} <span className="text-sm text-slate-500 font-bold tracking-normal uppercase ml-1">Remaining</span>
                            </p>
                        </div>
                        {status.is_circuit_breaker_active && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full">
                                <ShieldCheck className="w-3 h-3 text-rose-500" />
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Circuit Breaker</span>
                            </div>
                        )}
                    </div>

                    <p className="text-xs font-bold text-slate-500 leading-relaxed">
                        You have <span className="text-white">${status.remaining_credit.toFixed(2)}</span> remaining of your <span className="text-blue-400">$10.00</span> AI Pro Developer Credit.
                    </p>

                    {/* Sparkline */}
                    <div className="h-12 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={mockTrendData}>
                                <defs>
                                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={status.remaining_credit < 2.0 ? "#f43f5e" : "#3b82f6"} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={status.remaining_credit < 2.0 ? "#f43f5e" : "#3b82f6"} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area
                                    type="monotone"
                                    dataKey="spend"
                                    stroke={status.remaining_credit < 2.0 ? "#f43f5e" : "#3b82f6"}
                                    fillOpacity={1}
                                    fill="url(#colorSpend)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-3 h-3 text-slate-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Resets in {status.days_until_reset} days</span>
                        </div>
                        {status.remaining_credit < 2.0 && (
                            <div className="flex items-center gap-1 text-rose-500 animate-pulse">
                                <AlertCircle className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Low Balance!</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BillingWallet;
