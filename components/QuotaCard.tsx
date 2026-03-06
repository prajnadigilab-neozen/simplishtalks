
import React from 'react';

interface QuotaCardProps {
    label: string;
    current: number;
    limit: number;
    unit: string;
    color: string;
}

const QuotaCard: React.FC<QuotaCardProps> = ({ label, current, limit, unit, color }) => {
    const percentage = Math.min((current / limit) * 100, 100);
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900/50 rounded-3xl border border-slate-800 shadow-xl">
            <div className="relative flex items-center justify-center">
                <svg className="h-32 w-32 -rotate-90 transform">
                    <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-slate-800"
                    />
                    <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className={`transition-all duration-1000 ease-out ${color}`}
                    />
                </svg>
                <div className="absolute flex flex-col items-center">
                    <span className="text-xl font-black text-white">{Math.round(percentage)}%</span>
                </div>
            </div>

            <div className="mt-4 text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500">{label}</p>
                <div className="mt-1 flex items-baseline justify-center space-x-1">
                    <span className="text-2xl font-black text-white">{current.toLocaleString()}</span>
                    <span className="text-xs font-bold text-slate-600">/ {limit.toLocaleString()} {unit}</span>
                </div>
            </div>
        </div>
    );
};

export default QuotaCard;
