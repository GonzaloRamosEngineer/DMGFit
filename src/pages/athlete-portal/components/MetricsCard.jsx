import React, { useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area
} from 'recharts';
import Icon from '../../../components/AppIcon';

// Función auxiliar para formatear fechas
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return `${date.getDate()}/${date.getMonth() + 1}`;
};

// Componente principal
const MetricsCard = ({ metrics = [] }) => {
  
  // 1. PROCESAMIENTO DE DATOS (Inteligencia de Negocio)
  const processedData = useMemo(() => {
    if (!metrics.length) return { latest: {}, history: [], radar: [] };

    // Agrupar por tipo de métrica
    const groups = {};
    metrics.forEach(m => {
      if (!groups[m.name]) groups[m.name] = [];
      groups[m.name].push(m);
    });

    // Calcular KPIs actuales (Último valor registrado vs Anterior)
    const latestKPIs = Object.keys(groups).map(name => {
      const sorted = groups[name].sort((a, b) => new Date(b.metric_date) - new Date(a.metric_date));
      const current = sorted[0];
      const previous = sorted[1];
      
      const isWeight = name.toLowerCase().includes('peso');
      const diff = previous ? (current.value - previous.value) : 0;
      
      // Lógica de "bueno" o "malo": 
      // Si es peso, bajar suele ser "bueno" (depende el objetivo, pero asumimos fitness general).
      // Si es fuerza (sentadilla), subir es "bueno".
      let status = 'neutral';
      if (diff > 0) status = isWeight ? 'warning' : 'success'; // Subir peso = warning, Subir fuerza = success
      if (diff < 0) status = isWeight ? 'success' : 'warning'; // Bajar peso = success, Bajar fuerza = warning

      return {
        name,
        value: current.value,
        unit: current.unit,
        diff: diff.toFixed(1),
        date: current.metric_date,
        status,
        history: sorted.reverse() // Para el gráfico pequeño
      };
    });

    // Datos para el Gráfico de Radar (Normalización 0-100 para comparar peras con manzanas)
    // Esto es "simulado" para visualizar, idealmente se compara contra un estándar.
    const radarData = latestKPIs.map(kpi => {
      // Normalización simple: Asumimos un "techo" arbitrario para que el gráfico se vea bien
      let maxRef = 150; // Por defecto
      if (kpi.name.includes('Peso')) maxRef = 100;
      if (kpi.name.includes('Sentadilla')) maxRef = 200;
      
      return {
        subject: kpi.name,
        A: (kpi.value / maxRef) * 100, // Porcentaje del "máximo ideal"
        fullMark: 100
      };
    });

    return { latest: latestKPIs, radar: radarData };
  }, [metrics]);

  if (!metrics || metrics.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-gray-100 text-center text-gray-400">
        <Icon name="BarChart2" className="mx-auto mb-2 opacity-50" />
        <p>Aún no hay métricas registradas. ¡Haz tu primer registro arriba!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* SECCIÓN 1: RESUMEN DE ALTO NIVEL (TARJETAS PRO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {processedData.latest.map((kpi) => (
          <div key={kpi.name} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{kpi.name}</p>
                <h3 className="text-2xl font-bold text-gray-800 mt-1">
                  {kpi.value} <span className="text-sm font-normal text-gray-500">{kpi.unit}</span>
                </h3>
              </div>
              
              {/* Indicador de Tendencia (Flecha) */}
              {Math.abs(kpi.diff) > 0 && (
                <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${
                  kpi.status === 'success' ? 'bg-green-100 text-green-700' : 
                  kpi.status === 'warning' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {kpi.diff > 0 ? '▲' : '▼'} {Math.abs(kpi.diff)}
                </div>
              )}
            </div>

            {/* Mini Gráfico (Sparkline) dentro de la tarjeta */}
            <div className="h-16 mt-4 -mx-2 -mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={kpi.history}>
                  <defs>
                    <linearGradient id={`color${kpi.name}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill={`url(#color${kpi.name})`} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-right">Última: {formatDate(kpi.date)}</p>
          </div>
        ))}
      </div>

      {/* SECCIÓN 2: ANÁLISIS VISUAL (RADAR + COMPARATIVAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* GRÁFICO DE RADAR (PERFIL ATLÉTICO) */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center">
          <h4 className="text-sm font-bold text-gray-700 w-full mb-4 flex items-center gap-2">
            <Icon name="Activity" size={16} /> Perfil Atlético
          </h4>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={processedData.radar}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Atleta"
                  dataKey="A"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="#3B82F6"
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-center text-gray-400 mt-2">Balance entre métricas registradas</p>
        </div>

        {/* HISTORIAL DETALLADO (LISTA MEJORADA) */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm overflow-hidden">
           <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Icon name="List" size={16} /> Historial Reciente
          </h4>
          <div className="overflow-y-auto max-h-64 pr-2 space-y-3">
             {/* Mostramos todas las métricas en una lista más limpia */}
             {metrics.slice(0, 10).map((m, i) => (
               <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                 <div className="flex items-center gap-3">
                   <div className={`w-2 h-8 rounded-full ${m.name.includes('Peso') ? 'bg-orange-400' : 'bg-blue-500'}`}></div>
                   <div>
                     <p className="font-bold text-gray-700 text-sm">{m.name}</p>
                     <p className="text-xs text-gray-400">{formatDate(m.metric_date)}</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <span className="font-mono font-bold text-gray-800">{m.value}</span>
                   <span className="text-xs text-gray-500 ml-1">{m.unit}</span>
                 </div>
               </div>
             ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default MetricsCard;