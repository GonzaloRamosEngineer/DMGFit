import React, { useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, Cell } from 'recharts';
import Icon from '../../../components/AppIcon';

const PerformanceScatterChart = ({ data, onAthleteClick }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0]?.payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 md:p-4 shadow-lg">
          <p className="font-medium text-foreground text-sm md:text-base mb-2">{data?.name}</p>
          <div className="space-y-1 text-xs md:text-sm">
            <p className="text-muted-foreground">
              Asistencia: <span className="text-foreground font-medium">{data?.attendance}%</span>
            </p>
            <p className="text-muted-foreground">
              Mejora: <span className="text-foreground font-medium">+{data?.improvement}%</span>
            </p>
            <p className="text-muted-foreground">
              Puntuación: <span className="text-foreground font-medium">{data?.score}/100</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleClick = (data) => {
    if (onAthleteClick) {
      onAthleteClick(data);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h3 className="text-base md:text-lg lg:text-xl font-heading font-semibold text-foreground mb-1 md:mb-2">
            Correlación Asistencia vs Mejora
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Haz clic en un punto para ver detalles del atleta
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1 md:gap-2">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary"></div>
            <span className="text-xs md:text-sm text-muted-foreground">Alto rendimiento</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-warning"></div>
            <span className="text-xs md:text-sm text-muted-foreground">Medio</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-muted"></div>
            <span className="text-xs md:text-sm text-muted-foreground">Bajo</span>
          </div>
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
              stroke="var(--color-muted-foreground)"
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
              label={{ value: 'Tasa de Asistencia (%)', position: 'insideBottom', offset: -10, fill: 'var(--color-muted-foreground)' }}
            />
            <YAxis 
              type="number" 
              dataKey="improvement" 
              name="Mejora" 
              unit="%" 
              stroke="var(--color-muted-foreground)"
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
              label={{ value: 'Mejora de Rendimiento (%)', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)' }}
            />
            <ZAxis type="number" dataKey="score" range={[50, 400]} />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter 
              data={data} 
              onClick={handleClick}
              onMouseEnter={(data) => setHoveredPoint(data?.id)}
              onMouseLeave={() => setHoveredPoint(null)}
              style={{ cursor: 'pointer' }}
            >
              {data?.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={
                    entry?.score >= 80 
                      ? 'var(--color-primary)' 
                      : entry?.score >= 60 
                        ? 'var(--color-warning)' 
                        : 'var(--color-muted)'
                  }
                  opacity={hoveredPoint === entry?.id ? 1 : 0.8}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 md:mt-6 flex items-start gap-2 md:gap-3 p-3 md:p-4 bg-accent/10 rounded-lg border border-accent/20">
        <Icon name="Info" size={18} color="var(--color-accent)" className="flex-shrink-0 mt-0.5 md:w-5 md:h-5" />
        <p className="text-xs md:text-sm text-foreground">
          <span className="font-medium">Insight:</span> Los atletas con asistencia superior al 85% muestran una mejora promedio del 28% en rendimiento, comparado con el 12% de aquellos con asistencia inferior al 70%.
        </p>
      </div>
    </div>
  );
};

export default PerformanceScatterChart;