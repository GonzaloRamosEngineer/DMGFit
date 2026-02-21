import React, { useState, useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';

const AttendancePerformanceChart = ({ data, onDrillDown, loading = false }) => {
  const [activeView, setActiveView] = useState('week');

  const viewOptions = [
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'quarter', label: 'Trimestre' }
  ];

  // Colores alineados con Tailwind
  const COLOR_BAR = "#3b82f6"; // blue-500 (Asistencia)
  const COLOR_LINE = "#8b5cf6"; // violet-500 (Rendimiento)

  // Cálculos reales para las métricas inferiores
  const averages = useMemo(() => {
    if (!data || data.length === 0) return { attendance: 0, performance: 0 };
    const sumAtt = data.reduce((acc, curr) => acc + (curr.attendance || 0), 0);
    const sumPerf = data.reduce((acc, curr) => acc + (curr.performance || 0), 0);
    return {
      attendance: Math.round(sumAtt / data.length),
      performance: (sumPerf / data.length).toFixed(1)
    };
  }, [data]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 shadow-xl shadow-slate-200/50 z-50 min-w-[150px]">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1.5 last:mb-0">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                <span className="text-sm font-bold text-slate-600">{entry.name}</span>
              </div>
              <span className="text-sm font-black text-slate-800">
                {entry.name === 'Asistencia' ? entry.value : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // 1. ESTADO DE CARGA VISUAL
  if (loading) {
    return (
      <div className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 animate-pulse shadow-sm h-full flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <div className="space-y-2">
            <div className="h-6 bg-slate-100 rounded-lg w-48"></div>
            <div className="h-3 bg-slate-100 rounded w-32"></div>
          </div>
          <div className="h-10 bg-slate-100 rounded-xl w-32 hidden sm:block"></div>
        </div>
        <div className="flex-1 bg-slate-50/50 rounded-2xl w-full min-h-[300px]"></div>
        <div className="mt-6 pt-6 border-t border-slate-50 flex gap-6">
          <div className="h-10 bg-slate-100 rounded-xl w-1/3"></div>
          <div className="h-10 bg-slate-100 rounded-xl w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col h-full">
      
      {/* Cabecera del Gráfico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-100">
            <Icon name="Activity" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              Asistencia vs. Rendimiento
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Correlación de los últimos 7 días
            </p>
          </div>
        </div>
        
        {/* Píldoras de Filtro de Tiempo */}
        <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100 self-start sm:self-auto">
          {viewOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setActiveView(option.value)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeView === option.value 
                  ? 'bg-white text-slate-800 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenedor del Gráfico */}
      <div className="w-full flex-1 min-h-[300px]" aria-label="Gráfico de asistencia y rendimiento">
        <ResponsiveContainer width="100%" height="100%">
          {data && data.length > 0 ? (
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="period" 
                stroke="#94a3b8"
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis 
                yAxisId="left"
                stroke="#94a3b8"
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
                dx={-10}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#94a3b8"
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
                dx={10}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Legend 
                wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', paddingTop: '20px' }}
                iconType="circle"
                iconSize={8}
              />
              <Bar 
                yAxisId="left"
                dataKey="attendance" 
                name="Asistencia"
                fill={COLOR_BAR} 
                radius={[6, 6, 6, 6]} // Bordes redondos en las barras
                barSize={32}
                onClick={(data) => onDrillDown && onDrillDown(data)}
                style={{ cursor: 'pointer' }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="performance" 
                name="Rendimiento"
                stroke={COLOR_LINE} 
                strokeWidth={4}
                dot={{ fill: COLOR_LINE, stroke: '#ffffff', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 8, strokeWidth: 0, fill: COLOR_LINE, className: "shadow-xl" }}
              />
            </ComposedChart>
          ) : (
            <div className="flex flex-col h-full items-center justify-center text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
              <Icon name="BarChart2" size={32} className="text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-500">No hay datos suficientes</p>
            </div>
          )}
        </ResponsiveContainer>
      </div>

      {/* Resumen Promedios (Real) */}
      <div className="mt-8 pt-6 border-t border-slate-100">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Icon name="Users" size={16} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Asistencia Prom.</p>
              <p className="text-lg font-black text-slate-800 leading-none mt-1">{averages.attendance}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
            <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
              <Icon name="Award" size={16} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rendimiento Prom.</p>
              <p className="text-lg font-black text-slate-800 leading-none mt-1">{averages.performance}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl col-span-2 md:col-span-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Icon name="TrendingUp" size={16} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tendencia</p>
              <p className="text-sm font-black text-emerald-600 leading-none mt-1.5">Positiva</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AttendancePerformanceChart;