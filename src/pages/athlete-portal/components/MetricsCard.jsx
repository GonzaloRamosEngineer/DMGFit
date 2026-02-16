import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import Icon from '../../../components/AppIcon';

// --- CONFIG & UTILS ---

// Detect category based on metric name for styling
const getMetricTheme = (name) => {
  const n = name.toLowerCase();
  if (n.includes('peso') || n.includes('grasa') || n.includes('body')) {
    return { type: 'body', color: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', stroke: '#F59E0B' };
  }
  if (n.includes('sprint') || n.includes('correr') || n.includes('vo2')) {
    return { type: 'cardio', color: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', stroke: '#10B981' };
  }
  // Default: Strength
  return { type: 'strength', color: '#3B82F6', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', stroke: '#3B82F6' };
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

const MetricTile = ({ data }) => {
  const { theme } = data;
  const isPositive = data.diff > 0;
  const isNeutral = data.diff === 0;

  return (
    <div className="relative overflow-hidden bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
      
      {/* Header */}
      <div className="relative z-10 flex justify-between items-start mb-2">
        <div className={`p-2 rounded-xl ${theme.bg}`}>
          <Icon name="Activity" size={18} className={theme.text} />
        </div>
        
        {/* Badge de Tendencia */}
        {!isNeutral && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            <span>{isPositive ? '↑' : '↓'} {Math.abs(data.percentChange)}%</span>
          </div>
        )}
      </div>

      {/* Main Stats */}
      <div className="relative z-10 mb-8">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">
          {data.name}
        </h4>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black text-slate-900 tracking-tighter">
            {data.current}
          </span>
          <span className="text-xs font-bold text-slate-400 uppercase">
            {data.unit}
          </span>
        </div>
        <p className="text-[9px] text-slate-300 font-bold mt-1 uppercase tracking-wide">
          {formatDate(data.date)}
        </p>
      </div>

      {/* Background Sparkline Chart */}
      <div className="absolute bottom-0 left-0 right-0 h-24 opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.chartData}>
            <defs>
              <linearGradient id={`grad-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.color} stopOpacity={0.8}/>
                <stop offset="100%" stopColor={theme.color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={theme.color} 
              strokeWidth={3} 
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
  <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors group">
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white ${item.theme.border}`}>
        <span className={`text-[10px] font-black uppercase ${item.theme.text}`}>
          {item.name.substring(0, 2)}
        </span>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
          {item.name}
        </p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {formatDate(item.metric_date || item.date)}
        </p>
      </div>
    </div>
    <div className="text-right">
      <span className="block text-sm font-black text-slate-900">
        {item.value}
      </span>
      <span className="text-[9px] font-bold text-slate-400 uppercase">
        {item.unit}
      </span>
    </div>
  </div>
);

// --- MAIN COMPONENT ---

const MetricsCard = ({ metrics = [] }) => {
  const { tiles, history } = useMetricsProcessor(metrics);

  if (!metrics || metrics.length === 0) {
    return (
      <div className="col-span-full bg-white rounded-[2.5rem] p-10 border border-slate-100 border-dashed flex flex-col items-center justify-center text-center opacity-60 min-h-[200px]">
        <Icon name="Activity" size={32} className="text-slate-300 mb-2" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          No hay métricas registradas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* SECTION 1: KPI TILES GRID */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-2">
           <Icon name="Grid" size={16} className="text-slate-400" />
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
              Resumen de Métricas
           </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tiles.map((tile) => (
            <MetricTile key={tile.id} data={tile} />
          ))}
        </div>
      </div>

      {/* SECTION 2: RECENT HISTORY LIST */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-100 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-900 rounded-lg text-white">
                <Icon name="List" size={16} />
             </div>
             <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Historial Reciente</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Últimos Registros</p>
             </div>
          </div>
        </div>

        <div className="space-y-1">
          {history.map((item, index) => (
            <HistoryRow key={`${item.name}-${index}`} item={item} />
          ))}
        </div>
        
        {/* Footer Fade for List */}
        <div className="mt-4 pt-4 border-t border-slate-50 text-center">
           <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 transition-colors">
              Ver base de datos completa
           </button>
        </div>
      </div>
    </div>
  );
};

export default MetricsCard;