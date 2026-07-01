import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';

const AthleteSegmentation = ({ segmentationData, loading = false }) => {
  // Colores de DATO para el gráfico (recharts requiere hex). Paleta de categoría
  // intencional — distinta de los tokens de marca.
  const COLORS = {
    elite: '#10b981',      // emerald-500
    advanced: '#3b82f6',   // blue-500
    intermediate: '#fbbf24', // amber-400
    beginner: '#f97316'    // orange-500
  };

  if (loading) {
    return (
      <Card padding="default">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="h-8 w-12 ml-auto" />
            <Skeleton className="h-3 w-8 ml-auto" />
          </div>
        </div>
        <Skeleton className="h-[250px] rounded-2xl mb-6" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      </Card>
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
        <div className="bg-card border border-border rounded-xl p-3 shadow-xl">
          <p className="text-sm font-black text-text-primary mb-1">{payload[0].name}</p>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: payload[0].payload.color }}
            />
            <p className="text-xs font-bold text-text-secondary">
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
    const radius = outerRadius + 20;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="#1e293b" // text-slate-800
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-black"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card padding="default" className="hover:shadow-md transition-shadow duration-300 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-info-light text-primary flex items-center justify-center shadow-inner">
            <Icon name="PieChart" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-text-primary tracking-tight">
              Segmentación
            </h3>
            <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mt-0.5">
              Por nivel de rendimiento
            </p>
          </div>
        </div>
        <div className="text-right bg-muted px-4 py-2 rounded-xl border border-border">
          <p className="text-xl font-black text-text-primary">{total}</p>
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Total</p>
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="flex flex-col flex-1">
          {/* Chart Area */}
          <div className="h-[220px] w-full mb-6" aria-label="Gráfico de segmentación">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={85}
                  innerRadius={50}
                  paddingAngle={4}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      className="hover:opacity-80 transition-opacity cursor-pointer stroke-white stroke-2"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mt-auto">
            {chartData.map((segment) => {
              const percentage = ((segment.value / total) * 100).toFixed(1);
              return (
                <div
                  key={segment.name}
                  className="bg-muted/50 border border-border rounded-2xl p-3.5 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ backgroundColor: segment.color }}
                    />
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest truncate">
                      {segment.name}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-end justify-between mb-1.5">
                      <p className="text-xl font-black text-text-primary leading-none">
                        {segment.value}
                      </p>
                      <span className="text-[10px] font-bold text-text-tertiary">
                        {percentage}%
                      </span>
                    </div>

                    <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: segment.color
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-muted/50 rounded-2xl border-2 border-dashed border-border">
          <EmptyState
            iconName="PieChart"
            title="Sin Datos Aún"
            description="La segmentación aparecerá cuando registres atletas."
          />
        </div>
      )}
    </Card>
  );
};

export default AthleteSegmentation;