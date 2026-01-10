import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';

const AthleteSegmentation = ({ segmentationData }) => {
  const COLORS = {
    elite: '#30D158',
    advanced: '#00D4FF',
    intermediate: '#FFD700',
    beginner: '#FF9F0A'
  };

  const chartData = [
    { name: 'Elite', value: segmentationData?.elite, color: COLORS?.elite },
    { name: 'Avanzado', value: segmentationData?.advanced, color: COLORS?.advanced },
    { name: 'Intermedio', value: segmentationData?.intermediate, color: COLORS?.intermediate },
    { name: 'Principiante', value: segmentationData?.beginner, color: COLORS?.beginner }
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{payload?.[0]?.name}</p>
          <p className="text-xs text-muted-foreground">
            {payload?.[0]?.value} atletas ({((payload?.[0]?.value / segmentationData?.total) * 100)?.toFixed(1)}%)
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
          Segmentación de Atletas
        </h3>
        <Icon name="PieChart" size={20} color="var(--color-primary)" />
      </div>
      <div className="h-64 md:h-80" aria-label="Gráfico de segmentación de atletas por nivel">
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
              label={({ name, percent }) => `${name} ${(percent * 100)?.toFixed(0)}%`}
            >
              {chartData?.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry?.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              formatter={(value, entry) => (
                <span className="text-xs md:text-sm text-foreground">
                  {value} ({entry?.payload?.value})
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
        {chartData?.map((segment) => (
          <div key={segment?.name} className="text-center">
            <div
              className="w-3 h-3 rounded-full mx-auto mb-2"
              style={{ backgroundColor: segment?.color }}
            />
            <p className="text-xs text-muted-foreground mb-1">{segment?.name}</p>
            <p className="text-base md:text-lg font-heading font-bold text-foreground">
              {segment?.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AthleteSegmentation;