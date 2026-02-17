import React from 'react';
import Icon from '../../../components/AppIcon';

const QuickStats = ({ stats }) => {
  const items = [
    { label: 'Total Atletas', value: stats?.totalAthletes || 0, icon: 'Users', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Planes Activos', value: stats?.activePlans || 0, icon: 'Package', color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Sesiones Hoy', value: stats?.todaySessions || 0, icon: 'Calendar', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Completado', value: `${stats?.completionRate || 0}%`, icon: 'Activity', color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {items.map((item, idx) => (
        <div key={idx} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
           <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
              <p className="text-3xl font-black text-slate-800 tracking-tighter">{item.value}</p>
           </div>
           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.bg} ${item.color} group-hover:scale-110 transition-transform`}>
              <Icon name={item.icon} size={24} />
           </div>
        </div>
      ))}
    </div>
  );
};

export default QuickStats;