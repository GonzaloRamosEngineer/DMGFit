import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const PerformanceEvolutionChart = ({ data, athletes }) => {
  const [visibleAthletes, setVisibleAthletes] = useState(
    athletes?.reduce((acc, athlete) => ({ ...acc, [athlete?.id]: true }), {})
  );

  const toggleAthlete = (athleteId) => {
    setVisibleAthletes(prev => ({
      ...prev,
      [athleteId]: !prev?.[athleteId]
    }));
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 md:p-4 shadow-lg">
          <p className="font-medium text-foreground text-sm md:text-base mb-2">{label}</p>
          <div className="space-y-1">
            {payload?.map((entry, index) => (
              <div key={index} className="flex items-center justify-between gap-3 md:gap-4 text-xs md:text-sm">
                <span style={{ color: entry?.color }}>{entry?.name}</span>
                <span className="font-medium text-foreground">{entry?.value}/100</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h3 className="text-base md:text-lg lg:text-xl font-heading font-semibold text-foreground mb-1 md:mb-2">
            Evolución de Rendimiento
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Trayectorias de rendimiento de atletas seleccionados
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {athletes?.map(athlete => (
            <Button
              key={athlete?.id}
              variant={visibleAthletes?.[athlete?.id] ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleAthlete(athlete?.id)}
              className="text-xs md:text-sm"
            >
              <div 
                className="w-2 h-2 md:w-3 md:h-3 rounded-full mr-1 md:mr-2" 
                style={{ backgroundColor: athlete?.color }}
              ></div>
              {athlete?.name}
            </Button>
          ))}
        </div>
      </div>
      <div className="w-full h-64 md:h-80 lg:h-96" aria-label="Line chart showing performance evolution over time">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
            <XAxis 
              dataKey="month" 
              stroke="var(--color-muted-foreground)"
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
            />
            <YAxis 
              stroke="var(--color-muted-foreground)"
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
              label={{ value: 'Puntuación de Rendimiento', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            {athletes?.map(athlete => (
              visibleAthletes?.[athlete?.id] && (
                <Line
                  key={athlete?.id}
                  type="monotone"
                  dataKey={athlete?.dataKey}
                  name={athlete?.name}
                  stroke={athlete?.color}
                  strokeWidth={2}
                  dot={{ fill: athlete?.color, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 md:mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="p-3 md:p-4 bg-success/10 rounded-lg border border-success/20">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="TrendingUp" size={16} color="var(--color-success)" className="md:w-5 md:h-5" />
            <span className="text-xs md:text-sm font-medium text-success">Mejor Progreso</span>
          </div>
          <p className="text-sm md:text-base text-foreground font-semibold">Carlos Mendoza</p>
          <p className="text-xs md:text-sm text-muted-foreground">+32% en 6 meses</p>
        </div>

        <div className="p-3 md:p-4 bg-warning/10 rounded-lg border border-warning/20">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="Activity" size={16} color="var(--color-warning)" className="md:w-5 md:h-5" />
            <span className="text-xs md:text-sm font-medium text-warning">Más Consistente</span>
          </div>
          <p className="text-sm md:text-base text-foreground font-semibold">Ana Rodríguez</p>
          <p className="text-xs md:text-sm text-muted-foreground">Variación &lt;5%</p>
        </div>

        <div className="p-3 md:p-4 bg-accent/10 rounded-lg border border-accent/20">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="Target" size={16} color="var(--color-accent)" className="md:w-5 md:h-5" />
            <span className="text-xs md:text-sm font-medium text-accent">Cerca de Meta</span>
          </div>
          <p className="text-sm md:text-base text-foreground font-semibold">Miguel Torres</p>
          <p className="text-xs md:text-sm text-muted-foreground">95% de objetivo</p>
        </div>
      </div>
    </div>
  );
};

export default PerformanceEvolutionChart;