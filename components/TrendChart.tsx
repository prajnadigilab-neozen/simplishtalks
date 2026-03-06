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
        <div className="h-[400px] w-full rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800">
            <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Usage Trends</h3>
                <div className="flex space-x-4">
                    <div className="flex items-center space-x-2">
                        <div className="h-3 w-3 rounded-full bg-blue-500" />
                        <span className="text-xs text-slate-400 font-medium">Chat API</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="h-3 w-3 rounded-full bg-indigo-500" />
                        <span className="text-xs text-slate-400 font-medium">Voice API</span>
                    </div>
                </div>
            </div>

            <ResponsiveContainer width="100%" height="80%">
                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                        itemStyle={{ fontSize: '12px' }}
                    />
                    <Legend
                        verticalAlign="top"
                        height={36}
                        content={() => null} // We use our own legend
                    />
                    <Line
                        type="monotone"
                        dataKey="chat"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4, stroke: '#0f172a' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="voice"
                        stroke="#6366f1"
                        strokeWidth={3}
                        dot={{ fill: '#6366f1', strokeWidth: 2, r: 4, stroke: '#0f172a' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default TrendChart;
