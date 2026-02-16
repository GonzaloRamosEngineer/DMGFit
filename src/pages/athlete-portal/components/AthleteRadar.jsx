import React, { useMemo } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import Icon from '../../../components/AppIcon';

const AthleteRadar = ({ metrics }) => {
  const radarData = useMemo(() => {
    if (!metrics.length) return [];
    
    // Obtenemos el último valor de cada tipo de métrica
    const latestValues = {};
    metrics.forEach(m => {
        if (!latestValues[m.name] || new Date(m.metric_date) > new Date(latestValues[m.name].metric_date)) {
            latestValues[m.name] = m;
        }
    });

    // Transformamos para el gráfico y normalizamos (0-100)
    // NOTA: En un sistema real, el 'fullMark' vendría de un estándar de la industria o del nivel del atleta
    return Object.values(latestValues).map(m => {
        let maxVal = 100; 
        if (m.name.includes('Peso')) maxVal = 120;
        if (m.name.includes('Sentadilla')) maxVal = 150;
        if (m.name.includes('Banco')) maxVal = 100;
        
        return {
            subject: m.name,
            A: Math.min((parseFloat(m.value) / maxVal) * 100, 100), // Cap en 100%
            fullMark: 100,
            value: m.value,
            unit: m.unit
        };
    });
  }, [metrics]);

  if (radarData.length < 3) return null; // El radar se ve feo con menos de 3 puntos

  return (
    <div className="bg-gray-900 rounded-2xl p-6 shadow-lg text-white relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-[60px] opacity-20"></div>
      
      <div className="relative z-10 mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Icon name="Crosshair" className="text-blue-400" />
          Perfil Atlético
        </h3>
      </div>

      <div className="h-[250px] relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 'bold' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Atleta"
              dataKey="A"
              stroke="#60A5FA"
              strokeWidth={3}
              fill="#3B82F6"
              fillOpacity={0.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-center">
        <p className="text-xs text-gray-400">Puntaje calculado en base a estándares del club.</p>
      </div>
    </div>
  );
};

export default AthleteRadar;