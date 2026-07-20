import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';

// --- CONFIG & UTILS ---

// Detect category based on metric name for styling
const getMetricTheme = (name) => {
  const n = name.toLowerCase();
  // Composición corporal (peso corporal / grasa): acá BAJAR suele ser bueno.
  if (n.includes('peso corporal') || n.includes('grasa') || n.includes('body')) {
    return { type: 'body', color: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', stroke: '#F59E0B', inverse: true };
  }
  if (n.includes('sprint') || n.includes('correr') || n.includes('vo2')) {
    // En tiempos de sprint, bajar también es mejorar.
    return { type: 'cardio', color: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', stroke: '#10B981', inverse: n.includes('sprint') };
  }
  // Default: Strength — azul primary de marca (mismo azul que los charts del portal)
  return { type: 'strength', color: '#0066FF', bg: 'bg-info-light', text: 'text-primary', border: 'border-info-light', stroke: '#0066FF', inverse: false };
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date);
};

// --- LOGIC HOOK ---

const useMetricsProcessor = (metrics) => {
  return useMemo(() => {
    if (!metrics || !metrics.length) return { tiles: [], history: [] };

    // 1. Group by metric name
    const groups = {};
    metrics.forEach(m => {
      if (!groups[m.name]) groups[m.name] = [];
      groups[m.name].push(m);
    });

    // 2. Build Tile Data (KPIs)
    const tiles = Object.keys(groups).map(name => {
      // Sort: Newest first
      const sorted = groups[name].sort((a, b) => new Date(b.metric_date || b.date) - new Date(a.metric_date || a.date));
      const current = sorted[0];
      const previous = sorted[1];

      const valCurr = parseFloat(current.value);
      const valPrev = previous ? parseFloat(previous.value) : valCurr;

      const diff = valCurr - valPrev;
      const percentChange = valPrev !== 0 ? ((diff / valPrev) * 100).toFixed(1) : 0;

      // Reverse history for chart (Oldest -> Newest)
      const chartData = [...sorted].reverse().slice(-10); // Take last 10 points

      return {
        id: name,
        name,
        current: valCurr,
        unit: current.unit,
        diff,
        percentChange,
        date: current.metric_date || current.date,
        chartData,
        theme: getMetricTheme(name)
      };
    });

    // 3. Build Global History List (Flattened)
    const history = [...metrics]
      .sort((a, b) => new Date(b.metric_date || b.date) - new Date(a.metric_date || a.date))
      .slice(0, 8) // Top 8 recent entries
      .map(m => ({
        ...m,
        theme: getMetricTheme(m.name)
      }));

    return { tiles, history };
  }, [metrics]);
};

// --- SUB-COMPONENTS ---

// Cabecera canónica de card del portal: chip de ícono + kicker + título.
const CardHeader = ({ icon, kicker, title }) => (
  <div className="flex items-center gap-3">
    <div className="p-2 bg-info-light rounded-xl text-primary">
      <Icon name={icon} size={18} />
    </div>
    <div>
      <p className="text-[10px] font-black text-text-tertiary uppercase tracking-[0.18em]">{kicker}</p>
      <h3 className="text-lg font-black text-text-primary tracking-tight">{title}</h3>
    </div>
  </div>
);

// Tile compacta con la gramática del StatCard: label llano, valor grande,
// variación como pill chica y sparkline nítido en franja inferior propia.
const MetricTile = ({ data }) => {
  const { theme } = data;
  const isNeutral = data.diff === 0;
  // Si la métrica es "inversa" (peso corporal, grasa, sprint), bajar es bueno.
  const isGood = theme.inverse ? data.diff < 0 : data.diff > 0;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-3.5 md:p-4 hover:shadow-md transition-shadow duration-300">
      {/* Label + variación */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-[11px] md:text-xs font-semibold text-text-secondary leading-snug truncate">
          {data.name}
        </p>
        {!isNeutral && (
          <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black ${isGood ? 'bg-success-light text-success' : 'bg-error-light text-error'}`}>
            {data.diff > 0 ? '↑' : '↓'} {Math.abs(data.percentChange)}%
          </span>
        )}
      </div>

      {/* Valor + unidad (nunca se parten en dos líneas) */}
      <div className="whitespace-nowrap">
        <span className="text-xl md:text-2xl font-black text-text-primary tracking-tight tabular-nums">
          {Number(data.current).toLocaleString('es-AR')}
        </span>
        <span className="ml-1 text-[11px] font-bold text-text-tertiary uppercase">
          {data.unit}
        </span>
      </div>
      <p className="text-[9px] text-text-tertiary font-bold mt-0.5 uppercase tracking-wide">
        {formatDate(data.date)}
      </p>

      {/* Sparkline nítido en franja propia (no de fondo lavado) */}
      <div className="h-9 md:h-10 mt-2 -mx-1 pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.color} stopOpacity={0.22}/>
                <stop offset="100%" stopColor={theme.color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={theme.color}
              strokeWidth={2}
              fill={`url(#grad-${data.id})`}
              isAnimationActive={false} // Disable animation for smoother list scroll performance
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const HistoryRow = ({ item }) => (
  <div className="flex items-center justify-between p-3 hover:bg-muted rounded-2xl transition-colors group">
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 bg-card ${item.theme.border}`}>
        <span className={`text-[10px] font-black uppercase ${item.theme.text}`}>
          {item.name.substring(0, 2)}
        </span>
      </div>
      <div>
        <p className="text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">
          {item.name}
        </p>
        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
          {formatDate(item.metric_date || item.date)}
        </p>
      </div>
    </div>
    <div className="text-right">
      <span className="block text-sm font-black text-text-primary">
        {item.value}
      </span>
      <span className="text-[9px] font-bold text-text-tertiary uppercase">
        {item.unit}
      </span>
    </div>
  </div>
);

const EmptyState = () => (
  <div className="col-span-full bg-card rounded-3xl p-10 border border-border border-dashed flex flex-col items-center justify-center text-center opacity-60 min-h-[200px]">
    <Icon name="Activity" size={32} className="text-text-tertiary mb-2" />
    <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest">
      No hay métricas registradas
    </p>
  </div>
);

// --- EXPORTED BLOCKS ---

// Resumen: grid compacto de tiles (2 col en mobile) dentro de una card
// con la cabecera canónica del portal.
const MetricsSummary = ({ metrics = [] }) => {
  const { tiles } = useMetricsProcessor(metrics);

  if (!metrics || metrics.length === 0) return <EmptyState />;

  return (
    <div className="bg-card rounded-3xl p-5 md:p-6 border border-border shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)]">
      <div className="mb-4 md:mb-5">
        <CardHeader icon="LayoutGrid" kicker="Mediciones · Resumen" title="Resumen de métricas" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {tiles.map((tile) => (
          <MetricTile key={tile.id} data={tile} />
        ))}
      </div>
    </div>
  );
};

// Historial: lista de registros recientes.
const MetricsHistory = ({ metrics = [] }) => {
  const { history } = useMetricsProcessor(metrics);

  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="bg-card rounded-3xl p-5 md:p-6 border border-border shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)]">
      <div className="mb-4 md:mb-5">
        <CardHeader icon="List" kicker="Mediciones · Historial" title="Historial reciente" />
      </div>

      <div className="space-y-1">
        {history.map((item, index) => (
          <HistoryRow key={`${item.name}-${index}`} item={item} />
        ))}
      </div>

      {/* Footer Fade for List */}
      <div className="mt-4 pt-4 border-t border-border text-center">
        <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:text-primary/80 transition-colors">
          Ver historial completo
        </button>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT (compat: resumen + historial juntos) ---

const MetricsCard = ({ metrics = [] }) => (
  <div className="space-y-5">
    <MetricsSummary metrics={metrics} />
    <MetricsHistory metrics={metrics} />
  </div>
);

export { MetricsSummary, MetricsHistory };
export default MetricsCard;
