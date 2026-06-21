import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { TrendData } from '../utils/apiStatsUtils';

interface TrendChartProps {
    data: TrendData[];
}

const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
    return (
        <div className="h-[450px] w-full rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-white">API Usage Trends</h3>
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                        <div className="h-3 w-3 rounded-full bg-blue-500" />
                        <span className="text-xs text-slate-400 font-medium">TALKS Chat (Tokens)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="h-3 w-3 rounded-full bg-cyan-500" />
                        <span className="text-xs text-slate-400 font-medium">TALKS Voice (Seconds)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="h-3 w-3 rounded-full bg-orange-500" />
                        <span className="text-xs text-slate-400 font-medium">SNEHI Chat (Tokens)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="h-3 w-3 rounded-full bg-yellow-500" />
                        <span className="text-xs text-slate-400 font-medium">SNEHI Voice (Seconds)</span>
                    </div>
                </div>
            </div>

            <ResponsiveContainer width="100%" height="80%">
                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                        itemStyle={{ fontSize: '11px' }}
                    />
                    <Legend
                        verticalAlign="top"
                        height={36}
                        content={() => null} // We use our own legend
                    />
                    <Line
                        type="monotone"
                        dataKey="talksChat"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ fill: '#3b82f6', strokeWidth: 1.5, r: 3, stroke: '#0f172a' }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="talksVoice"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        dot={{ fill: '#06b6d4', strokeWidth: 1.5, r: 3, stroke: '#0f172a' }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="snehiChat"
                        stroke="#f97316"
                        strokeWidth={2.5}
                        dot={{ fill: '#f97316', strokeWidth: 1.5, r: 3, stroke: '#0f172a' }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="snehiVoice"
                        stroke="#eab308"
                        strokeWidth={2.5}
                        dot={{ fill: '#eab308', strokeWidth: 1.5, r: 3, stroke: '#0f172a' }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default TrendChart;
