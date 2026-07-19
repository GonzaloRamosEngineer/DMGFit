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
  if (ratio >= 2.5) return { label: 'Élite', color: 'text-purple-600', bg: 'bg-purple-50' };
  if (ratio >= 2.0) return { label: 'Avanzado', color: 'text-indigo-600', bg: 'bg-indigo-50' };
  if (ratio >= 1.5) return { label: 'Intermedio', color: 'text-blue-600', bg: 'bg-blue-50' };
  return { label: 'Base', color: 'text-text-secondary', bg: 'bg-muted' };
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
    ? 'text-success bg-success-light border-success/20'
    : 'text-error bg-error-light border-error/20';

  const IconName = trend.direction === 'up' ? 'TrendingUp' : 'TrendingDown';

  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border ${colorClass}`}>
      <Icon name={IconName} size={10} strokeWidth={3} />
      <span>{trend.percent}%</span>
    </div>
  );
};

const StatCard = ({ title, value, unit, icon, trend, subtext, highlight = false }) => {
  const iconBoxClasses = highlight
    ? "bg-info-light text-primary"
    : "bg-muted text-text-secondary group-hover:bg-info-light group-hover:text-primary";

  return (
    <div className="relative overflow-hidden rounded-3xl p-5 border bg-card text-text-primary shadow-sm border-border hover:border-primary/15 hover:shadow-md transition-all duration-300 group flex flex-col justify-between h-full min-h-[140px]">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${iconBoxClasses}`}>
          <Icon name={icon} size={20} />
        </div>
        {trend && <TrendPill trend={trend} inverse={title.includes('Peso') || title.includes('Grasa')} />}
      </div>

      {/* Content */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 text-text-tertiary">
          {title}
        </p>
        <div className="flex items-baseline gap-1">
          <h3 className="text-3xl font-black tracking-tighter text-text-primary">
            {value}
          </h3>
          {unit && <span className="text-xs font-bold uppercase text-text-tertiary">{unit}</span>}
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
      
      {/* 1. CARD DESTACADA: Disciplina */}
      <StatCard
        highlight
        title="Disciplina"
        value={attendanceRate}
        unit="%"
        icon="Calendar"
        subtext={
          <div className="flex items-center gap-2 mt-1">
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
               <div className="h-full bg-primary rounded-full" style={{ width: `${attendanceRate}%` }}></div>
            </div>
            <span className="text-[9px] font-bold text-primary uppercase">Tasa</span>
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
            <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-wide flex items-center gap-1">
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