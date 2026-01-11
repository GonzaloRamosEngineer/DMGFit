import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { supabase } from '../../../lib/supabaseClient'; // 1. Importamos Supabase

// ID del atleta que sembramos (lo usaremos fijo para probar, luego vendrá por prop)
const TEST_ATHLETE_ID = 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const PerformanceEvolutionChart = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ progress: 0, current: 0 });

  // Configuración de las líneas que vamos a graficar
  // Usamos los 'names' exactos que pusimos en el script SQL ('Peso Corporal' y 'Sentadilla')
  const metricsConfig = [
    { id: 'Sentadilla', name: 'Sentadilla (kg)', color: '#10B981', dataKey: 'Sentadilla' },
    { id: 'Peso Corporal', name: 'Peso Corporal (kg)', color: '#3B82F6', dataKey: 'Peso Corporal' }
  ];

  // Estado para mostrar/ocultar líneas
  const [visibleMetrics, setVisibleMetrics] = useState({
    'Sentadilla': true,
    'Peso Corporal': true
  });

  const toggleMetric = (metricId) => {
    setVisibleMetrics(prev => ({
      ...prev,
      [metricId]: !prev[metricId]
    }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // 2. Fetch a la base de datos (Vista 'metrics')
        const { data: dbData, error } = await supabase
          .from('metrics')
          .select('*')
          .eq('athlete_id', TEST_ATHLETE_ID)
          .in('name', ['Peso Corporal', 'Sentadilla']) // Filtramos solo lo que nos interesa
          .order('date', { ascending: true });

        if (error) throw error;

        if (dbData && dbData.length > 0) {
          // 3. Transformación de datos para Recharts
          // Recharts necesita: [{ date: '01/10', 'Sentadilla': 100, 'Peso Corporal': 80 }, ...]
          
          // Agrupamos por fecha
          const groupedByDate = {};
          
          dbData.forEach(item => {
            // Formatear fecha (ej: 2026-01-01 -> 01/01)
            const dateObj = new Date(item.date);
            const formattedDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

            if (!groupedByDate[formattedDate]) {
              groupedByDate[formattedDate] = { month: formattedDate }; // 'month' es el eje X
            }
            // Asignamos el valor a la clave correspondiente (ej: 'Sentadilla': 90)
            groupedByDate[formattedDate][item.name] = Number(item.value);
          });

          // Convertimos el objeto agrupado en array
          const formattedChartData = Object.values(groupedByDate);
          setChartData(formattedChartData);

          // 4. Calcular estadística simple para la tarjeta de "Progreso" (Sentadilla)
          const sentadillaData = dbData.filter(d => d.name === 'Sentadilla');
          if (sentadillaData.length > 1) {
            const first = Number(sentadillaData[0].value);
            const last = Number(sentadillaData[sentadillaData.length - 1].value);
            const improvement = ((last - first) / first) * 100;
            setStats({
              progress: improvement.toFixed(1),
              current: last
            });
          }
        }

      } catch (error) {
        console.error('Error cargando gráfico:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 md:p-4 shadow-lg">
          <p className="font-medium text-foreground text-sm md:text-base mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center justify-between gap-3 md:gap-4 text-xs md:text-sm">
                <span style={{ color: entry.color }}>{entry.name}</span>
                <span className="font-medium text-foreground">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando datos de rendimiento...</div>;
  }

  if (chartData.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No hay datos registrados para este período.</div>;
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h3 className="text-base md:text-lg lg:text-xl font-heading font-semibold text-foreground mb-1 md:mb-2">
            Evolución de Rendimiento
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Datos reales de Sentadilla vs Peso Corporal
          </p>
        </div>
        
        {/* Botones para activar/desactivar líneas */}
        <div className="flex flex-wrap gap-2">
          {metricsConfig.map(metric => (
            <Button
              key={metric.id}
              variant={visibleMetrics[metric.id] ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleMetric(metric.id)}
              className="text-xs md:text-sm"
            >
              <div 
                className="w-2 h-2 md:w-3 md:h-3 rounded-full mr-1 md:mr-2" 
                style={{ backgroundColor: metric.color }}
              ></div>
              {metric.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="w-full h-64 md:h-80 lg:h-96" aria-label="Line chart showing performance evolution over time">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
            <XAxis 
              dataKey="month" 
              stroke="var(--color-muted-foreground)"
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
            />
            <YAxis 
              stroke="var(--color-muted-foreground)"
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
              // Domain auto ajusta el gráfico para que no empiece siempre en 0 si los valores son altos
              domain={['auto', 'auto']} 
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
            
            {/* Renderizado dinámico de líneas */}
            {metricsConfig.map(metric => (
              visibleMetrics[metric.id] && (
                <Line
                  key={metric.id}
                  type="monotone"
                  dataKey={metric.dataKey}
                  name={metric.name}
                  stroke={metric.color}
                  strokeWidth={2}
                  dot={{ fill: metric.color, r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls // Conecta puntos si faltan datos intermedios
                />
              )
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 md:mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {/* Tarjeta Dinámica basada en DB */}
        <div className="p-3 md:p-4 bg-success/10 rounded-lg border border-success/20">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="TrendingUp" size={16} color="var(--color-success)" className="md:w-5 md:h-5" />
            <span className="text-xs md:text-sm font-medium text-success">Mejora en Sentadilla</span>
          </div>
          <p className="text-sm md:text-base text-foreground font-semibold">Atleta Carlos</p>
          <p className="text-xs md:text-sm text-muted-foreground">
            +{stats.progress}% (Actual: {stats.current}kg)
          </p>
        </div>

        {/* Estas tarjetas siguen estáticas por ahora, ideal para mostrar que puedes mezclar */}
        <div className="p-3 md:p-4 bg-warning/10 rounded-lg border border-warning/20 opacity-70">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="Activity" size={16} color="var(--color-warning)" className="md:w-5 md:h-5" />
            <span className="text-xs md:text-sm font-medium text-warning">Más Consistente</span>
          </div>
          <p className="text-sm md:text-base text-foreground font-semibold">Asistencia</p>
          <p className="text-xs md:text-sm text-muted-foreground">Datos en proceso...</p>
        </div>

        <div className="p-3 md:p-4 bg-accent/10 rounded-lg border border-accent/20 opacity-70">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="Target" size={16} color="var(--color-accent)" className="md:w-5 md:h-5" />
            <span className="text-xs md:text-sm font-medium text-accent">Meta de Peso</span>
          </div>
          <p className="text-sm md:text-base text-foreground font-semibold">Tendencia</p>
          <p className="text-xs md:text-sm text-muted-foreground">Bajando saludablemente</p>
        </div>
      </div>
    </div>
  );
};

export default PerformanceEvolutionChart;