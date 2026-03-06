import React from 'react';
import { LucideIcon } from 'lucide-react';

interface UsageCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    icon: LucideIcon;
    trend?: {
        value: number;
        isUp: boolean;
    };
    color: string;
}

const UsageCard: React.FC<UsageCardProps> = ({ title, value, subValue, icon: Icon, trend, color }) => {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800 hover:border-slate-700 transition-all duration-300">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-400">{title}</p>
                    <h3 className="mt-2 text-3xl font-bold text-white">{value}</h3>
                    {subValue && (
                        <p className="mt-1 text-sm text-slate-500">{subValue}</p>
                    )}
                </div>
                <div className={`rounded-xl p-3 ${color} bg-opacity-10`}>
                    <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
                </div>
            </div>

            {trend && (
                <div className="mt-4 flex items-center space-x-2">
                    <span className={`text-xs font-semibold ${trend.isUp ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {trend.isUp ? '↑' : '↓'} {trend.value}%
                    </span>
                    <span className="text-xs text-slate-500 text-nowrap">vs last 7 days</span>
                </div>
            )}

            {/* Decorative background element */}
            <div className={`absolute -right-4 -bottom-4 h-24 w-24 rounded-full opacity-5 pointer-events-none ${color}`} />
        </div>
    );
};

export default UsageCard;
