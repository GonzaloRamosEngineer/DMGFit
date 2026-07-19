import React, { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import Icon from '../../../components/AppIcon';

// Gráficos de ingresos con DATOS REALES (pagos status='paid').
// Reemplaza a los RevenueChart/PaymentMethodChart viejos que usaban mock.

const BRAND = '#FF4444';
const METHOD_COLORS = {
  efectivo: '#22c55e',
  transferencia: '#3b82f6',
  tarjeta: '#a855f7',
  mp: '#06b6d4',
  mercadopago: '#06b6d4',
  otro: '#9ca3af',
};
const METHOD_LABELS = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta',
  mp: 'Mercado Pago', mercadopago: 'Mercado Pago',
};

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
    .format(Number(n || 0));

const fmtShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${v}`;
};

const parseLocal = (s) => {
  if (!s) return null;
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const ChartCard = ({ title, icon, children, empty }) => (
  <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex flex-col">
    <div className="flex items-center gap-2 mb-2">
      <Icon name={icon} size={14} className="text-text-tertiary" />
      <h3 className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">{title}</h3>
    </div>
    {empty ? (
      <div className="flex-1 flex items-center justify-center text-xs font-semibold text-text-tertiary py-6">
        Sin ingresos registrados aún
      </div>
    ) : (
      <div className="flex-1">{children}</div>
    )}
  </div>
);

const PaymentInsights = ({ payments = [] }) => {
  const paid = useMemo(() => payments.filter((p) => p.status === 'paid'), [payments]);

  // Ingresos por mes (últimos 6 meses, incluyendo el actual)
  const byMonth = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS_ES[d.getMonth()], total: 0 });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    paid.forEach((p) => {
      const dt = parseLocal(p.payment_date);
      if (!dt) return;
      const k = `${dt.getFullYear()}-${dt.getMonth()}`;
      if (idx.has(k)) buckets[idx.get(k)].total += Number(p.amount || 0);
    });
    return buckets;
  }, [paid]);

  // Distribución por método
  const byMethod = useMemo(() => {
    const acc = {};
    paid.forEach((p) => {
      const raw = String(p.method || 'otro').toLowerCase();
      const key = METHOD_COLORS[raw] ? raw : 'otro';
      acc[key] = (acc[key] || 0) + Number(p.amount || 0);
    });
    return Object.entries(acc)
      .map(([key, value]) => ({
        key,
        name: METHOD_LABELS[key] || 'Otro',
        value,
        color: METHOD_COLORS[key] || METHOD_COLORS.otro,
      }))
      .sort((a, b) => b.value - a.value);
  }, [paid]);

  const hasRevenue = byMonth.some((b) => b.total > 0);
  const methodTotal = byMethod.reduce((s, m) => s + m.value, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
      <ChartCard title="Ingresos últimos 6 meses" icon="BarChart3" empty={!hasRevenue}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={byMonth} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              formatter={(v) => [fmtARS(v), 'Ingresos']}
              labelFormatter={(l) => `Mes: ${l}`}
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
            />
            <Bar dataKey="total" fill={BRAND} radius={[6, 6, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Ingresos por método de pago" icon="PieChart" empty={methodTotal <= 0}>
        <div className="flex items-center gap-4 h-[180px]">
          <ResponsiveContainer width="55%" height="100%">
            <PieChart>
              <Pie
                data={byMethod}
                dataKey="value"
                nameKey="name"
                innerRadius={38}
                outerRadius={64}
                paddingAngle={2}
              >
                {byMethod.map((m) => (
                  <Cell key={m.key} fill={m.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [fmtARS(v), n]} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {byMethod.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 font-bold text-text-secondary">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                  {m.name}
                </span>
                <span className="font-black text-text-primary">
                  {methodTotal > 0 ? Math.round((m.value / methodTotal) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>
    </div>
  );
};

export default PaymentInsights;
