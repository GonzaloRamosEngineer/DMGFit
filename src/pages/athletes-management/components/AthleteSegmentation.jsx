import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';

const AthleteSegmentation = ({ segmentationData, loading = false }) => {
  // Colores alineados con Tailwind (emerald, blue, amber, orange)
  const COLORS = {
    elite: '#10b981',      // emerald-500
    advanced: '#3b82f6',   // blue-500
    intermediate: '#fbbf24', // amber-400
    beginner: '#f97316'    // orange-500
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl"></div>
            <div className="space-y-2">
              <div className="h-5 bg-slate-100 rounded w-40"></div>
              <div className="h-3 bg-slate-100 rounded w-24"></div>
            </div>
          </div>
          <div className="space-y-2 text-right">
            <div className="h-8 bg-slate-100 rounded w-12 ml-auto"></div>
            <div className="h-3 bg-slate-100 rounded w-8 ml-auto"></div>
          </div>
        </div>
        <div className="h-[250px] bg-slate-50 rounded-2xl mb-6 animate-pulse"></div>
        <div className="grid grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[72px] bg-slate-50 rounded-2xl"></div>
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
        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-xl shadow-slate-200/50">
          <p className="text-sm font-black text-slate-800 mb-1">{payload[0].name}</p>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: payload[0].payload.color }}
            />
            <p className="text-xs font-bold text-slate-500">
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
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-full">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
            <Icon name="PieChart" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">
              Segmentación
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Por nivel de rendimiento
            </p>
          </div>
        </div>
        <div className="text-right bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <p className="text-xl font-black text-slate-800">{total}</p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</p>
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
                  className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ backgroundColor: segment.color }}
                    />
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
                      {segment.name}
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex items-end justify-between mb-1.5">
                      <p className="text-xl font-black text-slate-800 leading-none">
                        {segment.value}
                      </p>
                      <span className="text-[10px] font-bold text-slate-400">
                        {percentage}%
                      </span>
                    </div>
                    
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
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
        <div className="flex-1 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 py-10">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-slate-100">
            <Icon name="PieChart" size={28} className="text-slate-300" />
          </div>
          <p className="text-sm font-black text-slate-600 mb-1">Sin Datos Aún</p>
          <p className="text-xs font-medium text-slate-400 max-w-[200px]">
            La segmentación aparecerá cuando registres atletas.
          </p>
        </div>
      )}
    </div>
  );
};

export default AthleteSegmentation;