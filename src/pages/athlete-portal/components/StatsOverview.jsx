import React, { useMemo } from 'react';
import Icon from '../../../components/AppIcon';

// --- UTILS & LOGIC ---

// Calcula la variación % entre el último y penúltimo valor
const calculateTrend = (metrics, name) => {
  const sorted = metrics
    .filter(m => m.name === name)
    .sort((a, b) => new Date(b.metric_date) - new Date(a.metric_date));
  
  if (sorted.length < 2) return { value: 0, percent: 0, direction: 'neutral' };

  const current = parseFloat(sorted[0].value);
  const previous = parseFloat(sorted[1].value);
  const diff = current - previous;
  const percent = previous !== 0 ? ((diff / previous) * 100).toFixed(1) : 0;

  return {
    value: current,
    prev: previous,
    percent: Math.abs(percent),
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral',
    rawDiff: diff
  };
};

// Clasifica el Ratio de Fuerza (Total / Peso Corporal)
const getStrengthTier = (ratio) => {
  if (ratio >= 2.5) return { label: 'Élite', color: 'text-purple-400', bg: 'bg-purple-400/10' };
  if (ratio >= 2.0) return { label: 'Avanzado', color: 'text-indigo-400', bg: 'bg-indigo-400/10' };
  if (ratio >= 1.5) return { label: 'Intermedio', color: 'text-blue-400', bg: 'bg-blue-400/10' };
  return { label: 'Base', color: 'text-slate-400', bg: 'bg-slate-100' };
};

// --- SUB-COMPONENTS ---

const TrendPill = ({ trend, inverse = false }) => {
  if (trend.direction === 'neutral') return null;

  // Lógica de color: Normalmente subir es bueno (Green), bajar es malo (Red).
  // Si 'inverse' es true (ej. Grasa Corporal), bajar es bueno (Green).
  const isGood = inverse 
    ? trend.direction === 'down' 
    : trend.direction === 'up';

  const colorClass = isGood 
    ? 'text-emerald-600 bg-emerald-50 border-emerald-100' 
    : 'text-rose-600 bg-rose-50 border-rose-100';

  const IconName = trend.direction === 'up' ? 'TrendingUp' : 'TrendingDown';

  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border ${colorClass}`}>
      <Icon name={IconName} size={10} strokeWidth={3} />
      <span>{trend.percent}%</span>
    </div>
  );
};

const StatCard = ({ title, value, unit, icon, theme = 'light', trend, subtext, active = false }) => {
  // Estilos base según el tema (Dark para destacado, Light para estándar)
  const isDark = theme === 'dark';
  
  const containerClasses = isDark
    ? "bg-slate-900 text-white shadow-xl shadow-slate-900/20 border-slate-800"
    : "bg-white text-slate-800 shadow-sm border-slate-100 hover:border-blue-100 hover:shadow-md";

  const iconBoxClasses = isDark
    ? "bg-white/10 text-white"
    : "bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600";

  return (
    <div className={`relative overflow-hidden rounded-[2rem] p-5 border transition-all duration-300 group flex flex-col justify-between h-full min-h-[140px] ${containerClasses}`}>
      
      {/* Background Decorativo (Solo Dark) */}
      {isDark && (
        <>
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full blur-[60px] opacity-20 -mr-10 -mt-10"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-600 rounded-full blur-[50px] opacity-20 -ml-10 -mb-10"></div>
        </>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-2 relative z-10">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${iconBoxClasses}`}>
          <Icon name={icon} size={20} />
        </div>
        {trend && <TrendPill trend={trend} inverse={title.includes('Peso') || title.includes('Grasa')} />}
      </div>

      {/* Content */}
      <div className="relative z-10">
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
          {title}
        </p>
        <div className="flex items-baseline gap-1">
          <h3 className="text-3xl font-black tracking-tighter">
            {value}
          </h3>
          {unit && <span className={`text-xs font-bold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{unit}</span>}
        </div>
        
        {/* Subtext / Tier Badge */}
        {subtext && (
          <div className="mt-2">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const StatsOverview = ({ metrics, attendanceRate }) => {
  // 1. Procesamiento de Datos
  const stats = useMemo(() => {
    // Métricas clave
    const weightData = calculateTrend(metrics, 'Peso Corporal');
    const squatData = calculateTrend(metrics, 'Sentadilla');
    const deadliftData = calculateTrend(metrics, 'Peso Muerto');
    
    // Calcular Ratio de Fuerza (Suma de básicos / Peso corporal)
    // Usamos 0 si no hay datos para evitar NaN
    const totalStrength = (squatData.value || 0) + (deadliftData.value || 0);
    const bodyWeight = weightData.value || 80; // Fallback seguro para evitar división por cero
    
    const strengthRatio = (totalStrength > 0) 
      ? (totalStrength / bodyWeight).toFixed(2) 
      : '0.0';

    const tier = getStrengthTier(parseFloat(strengthRatio));

    return {
      weight: weightData,
      maxLift: deadliftData.value > squatData.value ? deadliftData : squatData, // Mostrar el levantamiento más fuerte
      maxLiftName: deadliftData.value > squatData.value ? 'Peso Muerto' : 'Sentadilla',
      strengthRatio,
      tier
    };
  }, [metrics]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* 1. CARD DESTACADA: Disciplina (Dark Mode) */}
      <StatCard 
        theme="dark"
        title="Disciplina"
        value={attendanceRate}
        unit="%"
        icon="Calendar"
        subtext={
          <div className="flex items-center gap-2 mt-1">
            <div className={`h-1.5 w-full bg-slate-800 rounded-full overflow-hidden`}>
               <div className="h-full bg-blue-500 rounded-full" style={{ width: `${attendanceRate}%` }}></div>
            </div>
            <span className="text-[9px] font-bold text-blue-400 uppercase">Tasa</span>
          </div>
        }
      />

      {/* 2. CARD: Ratio de Fuerza (Gamificación) */}
      <StatCard 
        title="Fuerza Relativa"
        value={`${stats.strengthRatio}x`}
        unit="BW"
        icon="Zap"
        subtext={
          <span className={`inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${stats.tier.bg} ${stats.tier.color}`}>
             {stats.tier.label}
          </span>
        }
      />

      {/* 3. CARD: Récord Personal (El mejor levantamiento) */}
      <StatCard 
        title="Mejor Levantamiento"
        value={stats.maxLift.value || 0}
        unit="KG"
        icon="TrendingUp"
        trend={stats.maxLift}
        subtext={
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <Icon name="Activity" size={10} />
                {stats.maxLiftName}
            </span>
        }
      />

      {/* 4. CARD: Composición Corporal */}
      <StatCard 
        title="Peso Actual"
        value={stats.weight.value || '-'}
        unit="KG"
        icon="User"
        trend={stats.weight} // El componente TrendPill maneja si bajar es bueno
      />
    </div>
  );
};

export default StatsOverview;