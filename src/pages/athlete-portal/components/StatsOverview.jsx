import React, { useMemo } from 'react';
import StatCard from '../../../components/ui/StatCard';

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
  if (ratio >= 2.5) return 'Élite';
  if (ratio >= 2.0) return 'Avanzado';
  if (ratio >= 1.5) return 'Intermedio';
  return 'Base';
};

// Devuelve la variación en texto compacto (ej. "+2.2%") o null si no hay tendencia.
const trendPct = (trend) => {
  if (!trend || trend.direction === 'neutral') return null;
  const sign = trend.direction === 'up' ? '+' : '−';
  return `${sign}${trend.percent}%`;
};

// Valor grande con la unidad como sufijo chico, sin que número y unidad se
// partan a dos líneas en las cards angostas de mobile.
const withUnit = (num, unit) => (
  <span className="whitespace-nowrap">
    {num}
    <span className="ml-1 text-base md:text-lg font-bold text-text-tertiary">{unit}</span>
  </span>
);

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

    return {
      weight: weightData,
      maxLift: deadliftData.value > squatData.value ? deadliftData : squatData, // Mostrar el levantamiento más fuerte
      maxLiftName: deadliftData.value > squatData.value ? 'Peso muerto' : 'Sentadilla',
      strengthRatio,
      tier: getStrengthTier(parseFloat(strengthRatio)),
    };
  }, [metrics]);

  const liftPct = trendPct(stats.maxLift);
  const weightPct = trendPct(stats.weight);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">

      {/* 1. Disciplina (tasa de asistencia) */}
      <StatCard
        label="Disciplina"
        value={`${attendanceRate || 0}%`}
        subtitle="Tu tasa de asistencia"
        icon="Calendar"
        tone="neutral"
        info="Porcentaje de asistencia a tus sesiones agendadas en el período."
      />

      {/* 2. Fuerza relativa (ratio de fuerza respecto al peso corporal) */}
      <StatCard
        label="Fuerza"
        value={`${stats.strengthRatio}x`}
        subtitle={`${stats.tier} · relativa a tu peso`}
        icon="Zap"
        tone="neutral"
        info="Cuántas veces tu peso corporal levantás sumando los básicos. A mayor número, más fuerte sos en relación a tu peso."
      />

      {/* 3. Mejor levantamiento (récord personal del básico más fuerte) */}
      <StatCard
        label="Mejor marca"
        value={stats.maxLift.value ? withUnit(stats.maxLift.value, 'kg') : '—'}
        subtitle={liftPct ? `${stats.maxLiftName} · ${liftPct}` : stats.maxLiftName}
        icon="TrendingUp"
        tone="neutral"
        info="Tu mejor marca entre sentadilla y peso muerto, según tus últimos registros."
      />

      {/* 4. Peso actual (composición corporal) */}
      <StatCard
        label="Peso actual"
        value={stats.weight.value ? withUnit(stats.weight.value, 'kg') : '—'}
        subtitle={weightPct ? `${weightPct} vs. anterior` : 'Último registro'}
        icon="User"
        tone="neutral"
        info="Tu último peso corporal registrado y su variación respecto a la medición anterior."
      />
    </div>
  );
};

export default StatsOverview;
