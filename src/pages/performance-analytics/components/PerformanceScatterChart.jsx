import React, { useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, Cell } from 'recharts';
import Icon from '../../../components/AppIcon';

const PerformanceScatterChart = ({ data, onAthleteClick, loading = false }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const pointData = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 md:p-4 shadow-lg z-50">
          <p className="font-medium text-foreground text-sm md:text-base mb-2">{pointData.name}</p>
          <div className="space-y-1 text-xs md:text-sm">
            <p className="text-muted-foreground">
              Asistencia: <span className="text-foreground font-medium">{pointData.attendance}%</span>
            </p>
            <p className="text-muted-foreground">
              Mejora: <span className="text-foreground font-medium">+{pointData.improvement}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 h-96 flex items-center justify-center animate-pulse">
         <p className="text-muted-foreground">Cargando análisis de correlación...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 h-96 flex flex-col items-center justify-center">
         <Icon name="BarChart2" size={48} className="text-muted-foreground mb-4 opacity-50" />
         <p className="text-muted-foreground text-center">No hay suficientes datos para generar la correlación.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h3 className="text-base md:text-lg lg:text-xl font-heading font-semibold text-foreground mb-1 md:mb-2">
            Correlación: Asistencia vs Mejora
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Visualiza cómo la asistencia impacta los resultados
          </p>
        </div>
        
        {/* Leyenda simple */}
        <div className="hidden md:flex items-center gap-3">
           <span className="text-xs text-muted-foreground">Cada punto es un atleta</span>
        </div>
      </div>

      <div className="w-full h-64 md:h-80 lg:h-96" aria-label="Scatter chart showing correlation between attendance and performance improvement">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
            <XAxis 
              type="number" 
              dataKey="attendance" 
              name="Asistencia" 
              unit="%" 
              domain={[0, 100]}
              stroke="var(--color-muted-foreground)"
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
              label={{ value: 'Asistencia (%)', position: 'insideBottom', offset: -10, fill: 'var(--color-muted-foreground)' }}
            />
            <YAxis 
              type="number" 
              dataKey="improvement" 
              name="Mejora" 
              unit="%" 
              stroke="var(--color-muted-foreground)"
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
              label={{ value: 'Mejora (%)', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)' }}
            />
            {/* ZAxis controla el tamaño del punto, fijo para uniformidad o dinámico si tienes 'score' */}
            <ZAxis type="number" range={[60, 60]} /> 
            
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            
            <Scatter 
              data={data} 
              onClick={(node) => onAthleteClick && onAthleteClick(node.payload)}
              onMouseEnter={(node) => setHoveredPoint(node.payload.id)}
              onMouseLeave={() => setHoveredPoint(null)}
              style={{ cursor: 'pointer' }}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.improvement > 20 ? 'var(--color-success)' : entry.improvement > 10 ? 'var(--color-primary)' : 'var(--color-warning)'}
                  opacity={hoveredPoint === entry.id ? 1 : 0.7}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 md:mt-6 flex items-start gap-2 md:gap-3 p-3 md:p-4 bg-accent/10 rounded-lg border border-accent/20">
        <Icon name="Info" size={18} color="var(--color-accent)" className="flex-shrink-0 mt-0.5 md:w-5 md:h-5" />
        <p className="text-xs md:text-sm text-foreground">
          <span className="font-medium">Análisis Automático:</span> Los datos sugieren una correlación positiva entre asistencia y mejora física.
        </p>
      </div>
    </div>
  );
};

export default PerformanceScatterChart;