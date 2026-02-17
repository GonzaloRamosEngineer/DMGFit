import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';

const COLORS = ['#3B82F6', '#6366F1', '#10B981', '#F59E0B', '#EF4444'];

const PaymentMethodChart = ({ data = [], loading = false }) => {
  if (loading) {
    return <div className="h-full bg-slate-50 rounded-2xl animate-pulse"></div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center opacity-50">
        <Icon name="PieChart" className="text-slate-300 mb-2" size={32} />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin datos</p>
      </div>
    );
  }

  // Ordenar datos para que los más grandes queden primero
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col h-full">
      {/* 1. CHART AREA (60% Height) */}
      <div className="h-[180px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sortedData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
              cornerRadius={5}
            >
              {sortedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
               contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#1E293B', color: '#fff' }}
               itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Centro del Donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
           <span className="text-2xl font-black text-slate-800">{sortedData.length}</span>
           <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tipos</span>
        </div>
      </div>

      {/* 2. LEGEND LIST (40% Height - Scrollable) */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2 mt-2">
        {sortedData.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors group cursor-default">
             <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900">{item.name}</span>
             </div>
             <div className="text-right">
                <span className="block text-xs font-black text-slate-800">{item.percentage}%</span>
                <span className="text-[9px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                   ${item.value.toLocaleString()}
                </span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaymentMethodChart;