import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import Icon from '../../../components/AppIcon';
import { formatDatePro } from '../../../utils/formatters';

// Utility for clean class merging
const cn = (...classes) => classes.filter(Boolean).join(' ');

const THEME = {
  primary: "#2563EB",
  grid: "#F8FAFC",
  text: "#94A3B8",
  accent: "#0F172A"
};

/**
 * HOOK: usePerformanceData
 * Handles all statistical processing and filtering
 */
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
      
      // Simple Moving Average (SMA) - 3 periods
      const windowSize = 3;
      const start = Math.max(0, idx - windowSize + 1);
      const windowItems = rawFiltered.slice(start, idx + 1);
      const sma = windowItems.reduce((acc, curr) => acc + parseFloat(curr.value), 0) / windowItems.length;

      return {
        ...m,
        displayDate: formatDatePro(m.metric_date || m.date),
        val: val,
        sma: parseFloat(sma.toFixed(2))
      };
    });

    const values = processedData.map(d => d.val);
    const first = values[0];
    const last = values[values.length - 1];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Simple Volatility calculation
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);

    return {
      data: processedData,
      stats: {
        current: last,
        change: last - first,
        max,
        min,
        avg: avg.toFixed(1),
        volatility: stdDev.toFixed(2),
        count: values.length
      }
    };
  }, [metrics, selectedMetric, timeRange]);
};

const ChartControls = React.memo(({ ranges, activeRange, onRangeChange, metrics, activeMetric, onMetricChange }) => (
  <div className="flex flex-col space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {metrics.map((m) => (
          <button
            key={m}
            onClick={() => onMetricChange(m)}
            className={cn(
              "whitespace-nowrap px-5 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all duration-300 border uppercase",
              activeMetric === m 
                ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200" 
                : "bg-transparent border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600"
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
        {ranges.map((r) => (
          <button
            key={r.value}
            onClick={() => onRangeChange(r.value)}
            className={cn(
              "px-4 py-1.5 text-[10px] font-black rounded-xl transition-all duration-200 uppercase",
              activeRange === r.value 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-400 hover:text-slate-500"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  </div>
));

const StatsGrid = ({ stats, unit }) => {
  if (!stats) return null;
  const items = [
    { label: 'Average', value: `${stats.avg}${unit}` },
    { label: 'Peak', value: `${stats.max}${unit}` },
    { label: 'Volatility', value: stats.volatility },
    { label: 'Samples', value: stats.count },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8 border-t border-slate-50">
      {items.map((item, i) => (
        <div key={i}>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">
            {item.label}
          </p>
          <p className="text-xl font-black text-slate-800 tracking-tighter">
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
    <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-2xl shadow-slate-200/50">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-50 pb-2">
        {label}
      </p>
      <div className="flex items-center justify-between gap-8">
        <span className="text-[10px] font-bold text-slate-500 uppercase">Value</span>
        <span className="text-lg font-black text-slate-900 tracking-tighter">
          {payload[0].value} <span className="text-xs font-medium text-blue-500">{payload[0].payload.unit}</span>
        </span>
      </div>
    </div>
  );
};

const PerformanceChart = ({ metrics = [] }) => {
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

  if (availableMetrics.length === 0) {
    return (
      <div className="bg-white rounded-[3rem] p-12 border border-slate-100 col-span-2 h-[450px] flex flex-col items-center justify-center">
        <Icon name="Activity" className="text-slate-200 mb-4" size={48} />
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest text-center">No data records found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[3rem] p-8 lg:p-12 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.05)] border border-slate-100 col-span-2 flex flex-col space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">
            Performance <span className="text-blue-600">Analytics</span>
          </h3>
          <p className="text-slate-300 font-bold text-[9px] uppercase tracking-[0.4em] mt-1">
            Biometric Intelligence System
          </p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-slate-50 hover:bg-slate-900 text-slate-900 hover:text-white rounded-2xl transition-all duration-500">
          <Icon name="Download" size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">Report</span>
        </button>
      </header>

      <ChartControls 
        ranges={ranges} activeRange={timeRange} onRangeChange={setTimeRange}
        metrics={availableMetrics} activeMetric={selectedMetric} onMetricChange={setSelectedMetric}
      />

      <div className="h-[350px] w-full -ml-4">
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
              <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: THEME.text, fontWeight: 800 }} dy={15} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: THEME.text, fontWeight: 800 }} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: THEME.primary, strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area type="monotone" dataKey="val" stroke={THEME.primary} strokeWidth={4} fill="url(#areaGrad)" animationDuration={1000} activeDot={{ r: 6, fill: THEME.accent, stroke: '#fff', strokeWidth: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Insufficient data for period</p>
          </div>
        )}
      </div>

      <StatsGrid stats={stats} unit={data[0]?.unit || ''} />

      <footer className="flex justify-between items-center text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">
        <span>Sync: {new Date().toLocaleDateString()}</span>
        <span className="flex items-center gap-1 italic">
          <Icon name="ShieldCheck" size={10} /> Verified Data
        </span>
      </footer>
    </div>
  );
};

export default PerformanceChart;