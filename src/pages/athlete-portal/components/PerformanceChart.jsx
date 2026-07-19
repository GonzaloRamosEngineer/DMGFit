import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import Icon from '../../../components/AppIcon';

// --- CONFIG & UTILS ---

// Paleta de dato de los charts del portal: el azul es el primary de marca.
const THEME = {
  primary: "#0066FF",
  grid: "#F1F5F9",
  text: "#94A3B8",
  accent: "#0F172A"
};

// Formateador interno para no depender de archivos externos
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date);
};

const cn = (...classes) => classes.filter(Boolean).join(' ');

// --- HOOKS ---

const usePerformanceData = (metrics, selectedMetric, timeRange) => {
  return useMemo(() => {
    if (!metrics || !Array.isArray(metrics)) return { data: [], stats: null };

    const now = new Date();
    let cutOffDate = new Date();
    
    const rangeMap = { 
      '1M': 1, '3M': 3, '6M': 6, 
      'YTD': now.getMonth() + 1, 
      'ALL': 120 
    };
    
    cutOffDate.setMonth(now.getMonth() - (rangeMap[timeRange] || 3));
    cutOffDate.setHours(0, 0, 0, 0);

    const rawFiltered = metrics
      .filter(m => {
        if (m.name !== selectedMetric) return false;
        const dateString = m.metric_date || m.date;
        if (!dateString) return false;
        const [y, month, d] = dateString.split('-').map(Number);
        return new Date(y, month - 1, d) >= cutOffDate;
      })
      .sort((a, b) => new Date(a.metric_date || a.date) - new Date(b.metric_date || b.date));

    if (rawFiltered.length === 0) return { data: [], stats: null };

    const processedData = rawFiltered.map((m, idx) => {
      const val = parseFloat(m.value) || 0;
      return {
        ...m,
        displayDate: formatDate(m.metric_date || m.date),
        val: val,
      };
    });

    const values = processedData.map(d => d.val);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Cálculo de Volatilidad (Desviación Estándar simplificada)
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);

    return {
      data: processedData,
      stats: {
        current: values[values.length - 1],
        max,
        avg: avg.toFixed(1),
        volatility: stdDev.toFixed(2),
        count: values.length
      }
    };
  }, [metrics, selectedMetric, timeRange]);
};

// --- SUB-COMPONENTS ---

const ChartControls = React.memo(({ ranges, activeRange, onRangeChange, metrics, activeMetric, onMetricChange, compact = false }) => (
  <div className="flex flex-col">
    <div className="flex flex-wrap items-center justify-between gap-4">
      {/* Pills de Métricas con Scroll Oculto */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
        {metrics.map((m) => (
          <button
            key={m}
            onClick={() => onMetricChange(m)}
            className={cn(
              "whitespace-nowrap rounded-full border text-[10px] font-bold tracking-widest transition-all duration-300 uppercase",
              compact ? "px-3 py-1.5" : "px-5 py-2",
              activeMetric === m
                ? "bg-primary border-primary text-white shadow-sm"
                : "bg-transparent border-border text-text-tertiary hover:border-border hover:text-text-secondary"
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Selector de Rango */}
      <div className="flex bg-muted p-1 rounded-2xl border border-border">
        {ranges.map((r) => (
          <button
            key={r.value}
            onClick={() => onRangeChange(r.value)}
            className={cn(
              "px-4 py-1.5 text-[10px] font-black rounded-xl transition-all duration-200 uppercase",
              activeRange === r.value
                ? "bg-card text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-secondary"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  </div>
));

const StatsGrid = ({ stats, unit, compact = false }) => {
  if (!stats) return null;
  const items = [
    { label: 'Promedio', value: `${stats.avg} ${unit}` },
    { label: 'Máximo', value: `${stats.max} ${unit}` },
    { label: 'Variación', value: stats.volatility },
    { label: 'Registros', value: stats.count },
  ];

  return (
    <div className={cn(
      "grid grid-cols-2 md:grid-cols-4 border-t border-border",
      compact ? "gap-4 py-4" : "gap-8 py-8"
    )}>
      {items.map((item, i) => (
        <div key={i}>
          <p className="text-[10px] font-black text-text-tertiary uppercase tracking-[0.18em] mb-1">
            {item.label}
          </p>
          <p className={cn("font-black text-text-primary", compact ? "text-base" : "text-xl")}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border border-border p-4 rounded-2xl shadow-lg">
      <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-2 border-b border-border pb-2">
        {label}
      </p>
      <div className="flex items-center justify-between gap-6">
        <span className="text-[10px] font-bold text-text-secondary uppercase">Valor</span>
        <span className="text-xl font-black text-text-primary">
          {payload[0].value} <span className="text-xs font-medium text-primary">{payload[0].payload.unit}</span>
        </span>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const PerformanceChart = ({ metrics = [], compact = false }) => {
  const [selectedMetric, setSelectedMetric] = useState('Peso Corporal');
  const [timeRange, setTimeRange] = useState('3M');
  
  const { data, stats } = usePerformanceData(metrics, selectedMetric, timeRange);

  const availableMetrics = useMemo(() => {
    if (!metrics) return [];
    return [...new Set(metrics.filter(m => m?.name).map(m => m.name))];
  }, [metrics]);

  const ranges = [
    { label: '1M', value: '1M' }, { label: '3M', value: '3M' },
    { label: '6M', value: '6M' }, { label: 'YTD', value: 'YTD' }, { label: 'ALL', value: 'ALL' },
  ];

  // Empty State Consistente
  if (availableMetrics.length === 0) {
    return (
      <div className={cn(
        "bg-card rounded-3xl border border-border flex flex-col items-center justify-center text-center opacity-70",
        compact ? "h-[270px] p-8" : "h-[450px] p-12 col-span-2"
      )}>
        <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mb-4 border border-dashed border-border">
           <Icon name="Activity" className="text-text-tertiary" size={22} />
        </div>
        <h3 className="text-text-primary font-black text-sm uppercase tracking-wide">Sin datos aún</h3>
        <p className="text-xs text-text-tertiary mt-2 max-w-[200px]">
           Registra tu primer progreso para ver la analítica.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-card rounded-3xl shadow-[0_20px_50px_-24px_rgba(15,23,42,0.14)] border border-border flex flex-col",
      compact ? "p-6 space-y-5" : "p-8 lg:p-12 space-y-10 col-span-2"
    )}>
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-info-light rounded-xl text-primary">
              <Icon name="Activity" size={20} />
           </div>
           <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-tertiary">
                Mediciones · Evolución
              </p>
              <h3 className={cn("font-black text-text-primary tracking-tight", compact ? "text-lg" : "text-2xl")}>
                Evolución de tus métricas
              </h3>
           </div>
        </div>
      </header>

      {/* Controls */}
      <ChartControls 
        ranges={ranges} activeRange={timeRange} onRangeChange={setTimeRange}
        metrics={availableMetrics} activeMetric={selectedMetric} onMetricChange={setSelectedMetric}
        compact={compact}
      />

      {/* Chart Area */}
      <div className={cn("w-full -ml-4", compact ? "h-[220px]" : "h-[350px]")}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={THEME.primary} stopOpacity={0.15}/>
                  <stop offset="100%" stopColor={THEME.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke={THEME.grid} />
              <XAxis 
                dataKey="displayDate" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: THEME.text, fontWeight: 800 }} 
                dy={15} 
              />
              <YAxis 
                domain={['dataMin - 1', 'dataMax + 1']} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: THEME.text, fontWeight: 800 }} 
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: THEME.primary, strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area 
                type="monotone" 
                dataKey="val" 
                stroke={THEME.primary} 
                strokeWidth={4} 
                fill="url(#areaGrad)" 
                animationDuration={1200} 
                activeDot={{ r: 6, fill: THEME.accent, stroke: '#fff', strokeWidth: 4, className: "shadow-lg" }} 
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center bg-muted rounded-3xl border border-dashed border-border opacity-60">
            <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">Datos insuficientes para este periodo</p>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <StatsGrid stats={stats} unit={data[0]?.unit || ''} compact={compact} />

      {/* Metadata Footer */}
      <footer className={cn(
        "justify-end items-center text-[10px] font-bold text-text-tertiary",
        compact ? "hidden md:flex" : "flex"
      )}>
        <span>Actualizado el {new Date().toLocaleDateString('es-AR')}</span>
      </footer>
    </div>
  );
};

export default PerformanceChart;
