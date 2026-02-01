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
      <div className="bg-white border border-border rounded-2xl p-6 animate-pulse shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 bg-muted/50 rounded-lg w-40"></div>
          <div className="w-10 h-10 bg-muted/30 rounded-lg"></div>
        </div>
        <div className="h-72 bg-muted/20 rounded-xl mb-6"></div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-muted/30 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  const chartData = [
    { name: 'Elite', value: segmentationData?.elite || 0, color: COLORS.elite, label: 'Elite' },
    { name: 'Avanzado', value: segmentationData?.advanced || 0, color: COLORS.advanced, label: 'Avanzado' },
    { name: 'Intermedio', value: segmentationData?.intermediate || 0, color: COLORS.intermediate, label: 'Intermedio' },
    { name: 'Principiante', value: segmentationData?.beginner || 0, color: COLORS.beginner, label: 'Principiante' }
  ].filter(item => item.value > 0);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const percentage = ((payload[0].value / total) * 100).toFixed(1);
      return (
        <div className="bg-white border-2 border-border rounded-xl px-4 py-3 shadow-xl">
          <p className="text-sm font-bold text-foreground mb-1">{payload[0].name}</p>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: payload[0].payload.color }}
            />
            <p className="text-xs text-muted-foreground font-medium">
              {payload[0].value} atletas · {percentage}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // No mostrar label si es menos del 5%

    return (
      <text
        x={x}
        y={y}
        fill="var(--color-foreground)"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-sm font-bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
            <Icon name="PieChart" size={20} color="var(--color-primary)" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-foreground">
              Segmentación de Atletas
            </h3>
            <p className="text-xs text-muted-foreground">
              Distribución por nivel
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-heading font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground font-medium">Total</p>
        </div>
      </div>

      {chartData.length > 0 ? (
        <>
          {/* Chart Area - Increased padding */}
          <div className="h-[340px] w-full mb-6" aria-label="Gráfico de segmentación">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={100}
                  innerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  paddingAngle={2}
                  animationBegin={0}
                  animationDuration={800}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      className="hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {chartData.map((segment) => {
              const percentage = ((segment.value / total) * 100).toFixed(1);
              return (
                <div 
                  key={segment.name} 
                  className="bg-gradient-to-br from-muted/30 to-muted/10 border border-border rounded-xl p-4 hover:shadow-md transition-all duration-200 hover:scale-105"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-4 h-4 rounded-full shadow-sm"
                      style={{ backgroundColor: segment.color }}
                    />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {segment.name}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-heading font-bold text-foreground">
                      {segment.value}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 flex-1 bg-muted/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: segment.color
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center text-center bg-muted/10 rounded-xl border-2 border-dashed border-border">
          <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
            <Icon name="BarChart2" size={32} className="text-muted-foreground opacity-50" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">Sin Datos de Segmentación</p>
          <p className="text-xs text-muted-foreground">
            Los datos aparecerán cuando haya atletas registrados
          </p>
        </div>
      )}
    </div>
  );
};

export default AthleteSegmentation;