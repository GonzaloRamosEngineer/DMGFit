import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const PerformanceChart = ({ data, period }) => {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground mb-2">{label}</p>
          {payload?.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry?.color }}
              />
              <span className="text-muted-foreground">{entry?.name}:</span>
              <span className="font-medium text-foreground data-text">{entry?.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-64 md:h-80 lg:h-96" aria-label="Gráfico de evolución de rendimiento">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis 
            dataKey="date" 
            stroke="var(--color-muted-foreground)"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="var(--color-muted-foreground)"
            style={{ fontSize: '12px' }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            iconType="circle"
          />
          <ReferenceLine 
            y={75} 
            stroke="var(--color-secondary)" 
            strokeDasharray="5 5" 
            label={{ value: 'Objetivo', position: 'right', fill: 'var(--color-secondary)', fontSize: 12 }}
          />
          <Line 
            type="monotone" 
            dataKey="fuerza" 
            stroke="var(--color-primary)" 
            strokeWidth={2}
            dot={{ fill: 'var(--color-primary)', r: 4 }}
            activeDot={{ r: 6 }}
            name="Fuerza"
          />
          <Line 
            type="monotone" 
            dataKey="resistencia" 
            stroke="var(--color-accent)" 
            strokeWidth={2}
            dot={{ fill: 'var(--color-accent)', r: 4 }}
            activeDot={{ r: 6 }}
            name="Resistencia"
          />
          <Line 
            type="monotone" 
            dataKey="tecnica" 
            stroke="var(--color-secondary)" 
            strokeWidth={2}
            dot={{ fill: 'var(--color-secondary)', r: 4 }}
            activeDot={{ r: 6 }}
            name="Técnica"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceChart;