import React from 'react';
import { getProgressColor } from '../utils/apiStatsUtils';

interface ProgressBarProps {
    current: number;
    total: number;
    label?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, label }) => {
    const percentage = Math.min((current / total) * 100, 100);
    const colorClass = getProgressColor(percentage);

    return (
        <div className="w-full space-y-2">
            {label && (
                <div className="flex justify-between text-sm font-medium text-slate-400">
                    <span>{label}</span>
                    <span>{percentage.toFixed(1)}%</span>
                </div>
            )}
            <div className="h-4 w-full overflow-hidden rounded-full bg-slate-800 shadow-inner">
                <div
                    className={`h-full transition-all duration-500 ease-out ${colorClass} shadow-[0_0_15px_rgba(0,0,0,0.2)]`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

export default ProgressBar;
