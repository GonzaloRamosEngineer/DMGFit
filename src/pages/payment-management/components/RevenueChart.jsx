import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';

const RevenueChart = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="h-full w-full bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center">
        <Icon name="Loader" className="text-slate-200 animate-spin" size={24} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center opacity-50">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin datos suficientes</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 0, left: -25, bottom: 0 }} barSize={32}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
        <XAxis 
          dataKey="month" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 700 }} 
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 700 }} 
          tickFormatter={(value) => `$${value/1000}k`}
        />
        <Tooltip 
          cursor={{ fill: '#F8FAFC' }}
          contentStyle={{ 
            backgroundColor: '#1E293B', 
            borderRadius: '12px', 
            border: 'none', 
            color: '#fff',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
          }}
          itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
          labelStyle={{ color: '#94A3B8', fontSize: '10px', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}
        />
        <Bar dataKey="efectivo" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} />
        <Bar dataKey="tarjeta" stackId="a" fill="#3B82F6" />
        <Bar dataKey="transferencia" stackId="a" fill="#6366F1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default RevenueChart;