import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';

const AthleteSegmentation = ({ segmentationData, loading = false }) => {
  const COLORS = {
    elite: '#30D158',
    advanced: '#00D4FF',
    intermediate: '#FFD700',
    beginner: '#FF9F0A'
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 animate-pulse">
        <div className="h-6 bg-muted/50 rounded w-1/2 mb-6"></div>
        <div className="h-64 bg-muted/30 rounded-full w-64 mx-auto mb-6"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 bg-muted/50 rounded"></div>
          <div className="h-10 bg-muted/50 rounded"></div>
        </div>
      </div>
    );
  }

  const chartData = [
    { name: 'Elite', value: segmentationData?.elite || 0, color: COLORS.elite },
    { name: 'Avanzado', value: segmentationData?.advanced || 0, color: COLORS.advanced },
    { name: 'Intermedio', value: segmentationData?.intermediate || 0, color: COLORS.intermediate },
    { name: 'Principiante', value: segmentationData?.beginner || 0, color: COLORS.beginner }
  ].filter(item => item.value > 0); // Solo mostramos segmentos con datos

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{payload[0].name}</p>
          <p className="text-xs text-muted-foreground">
            {payload[0].value} atletas ({((payload[0].value / (segmentationData?.total || 1)) * 100).toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h3 className="text-base md:text-lg font-heading font-semibold text-foreground">
          Segmentación
        </h3>
        <Icon name="PieChart" size={20} color="var(--color-primary)" />
      </div>

      {chartData.length > 0 ? (
        <>
          <div className="h-64 md:h-80" aria-label="Gráfico de segmentación">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value, entry) => (
                    <span className="text-xs md:text-sm text-foreground">
                      {value} ({entry.payload.value})
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-2 gap-3 md:gap-4 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
            {chartData.map((segment) => (
              <div key={segment.name} className="text-center">
                <div
                  className="w-3 h-3 rounded-full mx-auto mb-2"
                  style={{ backgroundColor: segment.color }}
                />
                <p className="text-xs text-muted-foreground mb-1">{segment.name}</p>
                <p className="text-base md:text-lg font-heading font-bold text-foreground">
                  {segment.value}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
          <Icon name="BarChart2" size={32} className="mb-2 opacity-50" />
          <p className="text-sm">Sin datos suficientes</p>
        </div>
      )}
    </div>
  );
};

export default AthleteSegmentation;