'use client';
import { Empty } from './ui';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
const tick = { fill: '#89909e', fontSize: 11 };
const tooltip = {
  border: '1px solid var(--line)',
  borderRadius: 12,
  background: 'var(--card)',
  color: 'var(--text)',
  fontSize: 12,
};
export function TrendChart({
  data,
  cash = false,
}: {
  data: { label: string; revenue: number; profit: number }[];
  cash?: boolean;
}) {
  if (!data.length) return <Empty text="Add a booking to see your revenue and profit trend." />;
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4d6ff5" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#4d6ff5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} minTickGap={22} />
          <YAxis
            tick={tick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              Math.abs(v) >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${(v / 1000).toFixed(0)}k`
            }
            width={64}
          />
          <Tooltip
            contentStyle={tooltip}
            formatter={(v) =>
              new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0,
              }).format(Number(v))
            }
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            name={cash ? 'Net cash received' : 'Revenue'}
            dataKey="revenue"
            stroke="#5873ed"
            fill="url(#revenueFill)"
            strokeWidth={2.5}
          />
          {!cash && (
            <Area
              isAnimationActive={false}
              type="monotone"
              name="Gross profit"
              dataKey="profit"
              stroke="#27aa94"
              fill="transparent"
              strokeWidth={2.5}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Bars({
  data,
  keys = [{ key: 'value', name: 'Revenue', color: '#657bea' }],
}: {
  data: Record<string, string | number>[];
  keys?: { key: string; name: string; color: string }[];
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} />
          <YAxis
            tick={tick}
            width={65}
            tickFormatter={(v) =>
              Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}k`
            }
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltip} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          {keys.map((k) => (
            <Bar
              isAnimationActive={false}
              key={k.key}
              dataKey={k.key}
              name={k.name}
              fill={k.color}
              radius={[5, 5, 0, 0]}
              maxBarSize={46}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
