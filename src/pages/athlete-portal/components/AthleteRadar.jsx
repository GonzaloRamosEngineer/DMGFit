import React, { useMemo } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';

// --- CONFIGURATION ---

// Definimos los estándares "Elite" (el 100%) para normalizar los datos.
// Esto separa la lógica de negocio de la visualización.
const METRIC_BENCHMARKS = {
  'Peso Corporal': 90,    // Ejemplo: 90kg es el 100% de la escala visual
  'Sentadilla': 140,      // 140kg
  'Press Banca': 100,     // 100kg
  'Peso Muerto': 160,     // 160kg
  'Sprint 10m': 30,       // km/h (o inversa si es tiempo)
  'Salto Vertical': 60,   // cm
  // Default fallback
  'default': 100
};

/**
 * HOOK: useRadarData
 * Normaliza los datos crudos a un puntaje 0-100 para que el gráfico sea coherente.
 */
const useRadarData = (metrics) => {
  return useMemo(() => {
    if (!metrics || !metrics.length) return { data: [], score: 0 };

    // 1. Obtener el registro más reciente por tipo de métrica
    const latestMap = new Map();
    metrics.forEach(m => {
      const current = latestMap.get(m.name);
      const mDate = new Date(m.metric_date || m.date);
      if (!current || mDate > new Date(current.metric_date || current.date)) {
        latestMap.set(m.name, m);
      }
    });

    // 2. Transformar y Normalizar
    const processedData = Array.from(latestMap.values()).map(m => {
      const benchmark = METRIC_BENCHMARKS[m.name] || METRIC_BENCHMARKS.default;
      const rawValue = parseFloat(m.value) || 0;
      
      // Cálculo de Score (Capado al 100% para no romper el gráfico visualmente)
      // Nota: Para métricas de tiempo (sprints), la lógica debería invertirse (menos es más)
      // Aquí asumimos "más es mejor" para simplificar el ejemplo base.
      const normalizedScore = Math.min((rawValue / benchmark) * 100, 100);

      return {
        subject: m.name,
        raw: rawValue,
        unit: m.unit,
        score: Math.round(normalizedScore),
        fullMark: 100
      };
    });

    // 3. Calcular Puntaje General Atlético (Promedio)
    const totalScore = processedData.reduce((acc, curr) => acc + curr.score, 0);
    const avgScore = processedData.length ? Math.round(totalScore / processedData.length) : 0;

    return { 
      data: processedData, 
      score: avgScore 
    };
  }, [metrics]);
};

// --- SUB-COMPONENTS ---

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border p-3 rounded-xl shadow-lg z-50">
        <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">
          {data.subject}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-text-primary font-black text-lg">
            {data.raw} <span className="text-xs text-text-tertiary font-bold">{data.unit}</span>
          </span>
          <span className="text-primary text-xs font-bold">
            ({data.score}%)
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// --- MAIN COMPONENT ---

const AthleteRadar = ({ metrics, compact = false }) => {
  const { data, score } = useRadarData(metrics);
  const isEnoughData = data.length >= 3;

  return (
    <div className={`bg-card rounded-3xl ${compact ? 'p-5 min-h-[270px]' : 'p-8 min-h-[400px]'} shadow-sm text-text-primary relative overflow-hidden flex flex-col border border-border`}>
      {/* Header */}
      <div className={`relative z-10 flex justify-between items-start ${compact ? 'mb-3' : 'mb-6'}`}>
        <div>
          <div className="flex items-center gap-3 mb-1">
             <div className={`${compact ? 'p-1.5' : 'p-2'} bg-info-light rounded-lg`}>
                <Icon name="Crosshair" className="text-primary" size={compact ? 16 : 20} />
             </div>
             <h3 className={`${compact ? 'text-base' : 'text-xl'} font-black text-text-primary tracking-tight`}>
               Perfil Atlético
             </h3>
          </div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[0.18em] pl-1">
            Tus métricas en un vistazo
          </p>
        </div>

        {/* Score Badge */}
        {isEnoughData && (
          <div className="text-right">
             <span className={`${compact ? 'text-2xl' : 'text-[32px]'} block font-black leading-none text-text-primary`}>
               {score}
             </span>
             <span className="text-[9px] font-bold text-primary uppercase tracking-widest bg-info-light px-2 py-0.5 rounded-full">
               Puntaje Global
             </span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 relative z-10 w-full flex items-center justify-center">
        {isEnoughData ? (
          <div className={`w-full ${compact ? 'h-[185px]' : 'h-[300px]'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
                <defs>
                  <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.6}/>
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                
                <PolarGrid stroke="#E2E8F0" strokeDasharray="4 4" />

                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: '#64748B', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}
                />
                
                <PolarRadiusAxis 
                  angle={30} 
                  domain={[0, 100]} 
                  tick={false} 
                  axisLine={false} 
                />
                
                <Radar
                  name="Performance"
                  dataKey="score"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  fill="url(#radarGradient)"
                  fillOpacity={0.5}
                />
                <Tooltip content={<CustomTooltip />} cursor={false} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Empty State con estilo */
          <div className={`flex flex-col items-center justify-center text-center border border-dashed border-border rounded-3xl bg-muted w-full ${compact ? 'h-[170px] p-4' : 'h-[250px] p-6'}`}>
             <Icon name="Activity" className="text-text-tertiary mb-3" size={compact ? 24 : 32} />
             <h4 className="text-text-secondary font-bold text-sm mb-1">Datos insuficientes</h4>
             <p className="text-text-tertiary text-xs max-w-[200px]">
               Registrá al menos 3 métricas diferentes para generar tu mapa de radar.
             </p>
          </div>
        )}
      </div>

      {/* Footer / Legend */}
      {isEnoughData && (
        <div className="mt-4 flex justify-center gap-6 border-t border-border pt-4 relative z-10">
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-tertiary">Rendimiento actual</span>
           </div>
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full border border-text-tertiary border-dashed"></span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-tertiary">Máximo (100%)</span>
           </div>
        </div>
      )}
    </div>
  );
};

export default AthleteRadar;
