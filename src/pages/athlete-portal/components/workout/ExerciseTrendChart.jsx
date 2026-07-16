import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Misma paleta de dato que PerformanceChart (consistencia del sistema).
const THEME = {
  primary: '#2563EB',
  grid: '#F8FAFC',
  text: '#94A3B8',
  accent: '#0F172A',
};

const shortDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
};

const TrendTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-[10px] font-black uppercase tracking-wider text-text-tertiary">{shortDate(label)}</p>
      <p className="text-sm font-black text-text-primary">
        {Number(payload[0].value).toLocaleString('es-AR', { maximumFractionDigits: 1 })} {unit}
      </p>
    </div>
  );
};

/**
 * Serie única de progreso de un ejercicio (mejor serie / 1RM / volumen por
 * sesión). points: [{ date: 'YYYY-MM-DD', value: number }]
 */
const ExerciseTrendChart = ({ points, unit = 'kg', height = 180, gradientId = 'exTrend' }) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={THEME.primary} stopOpacity={0.18} />
          <stop offset="100%" stopColor={THEME.primary} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} stroke={THEME.grid} />
      <XAxis
        dataKey="date"
        tickFormatter={shortDate}
        tick={{ fill: THEME.text, fontSize: 11, fontWeight: 700 }}
        axisLine={false}
        tickLine={false}
        minTickGap={24}
      />
      <YAxis
        tick={{ fill: THEME.text, fontSize: 11, fontWeight: 700 }}
        axisLine={false}
        tickLine={false}
        width={52}
        domain={['auto', 'auto']}
      />
      <Tooltip
        content={<TrendTooltip unit={unit} />}
        cursor={{ stroke: THEME.primary, strokeWidth: 1, strokeDasharray: '4 4' }}
      />
      <Area
        type="monotone"
        dataKey="value"
        stroke={THEME.primary}
        strokeWidth={2}
        fill={`url(#${gradientId})`}
        dot={points.length <= 20 ? { r: 3, fill: THEME.primary, strokeWidth: 0 } : false}
        activeDot={{ r: 6, fill: THEME.accent, stroke: '#fff', strokeWidth: 3 }}
      />
    </AreaChart>
  </ResponsiveContainer>
);

export default ExerciseTrendChart;
