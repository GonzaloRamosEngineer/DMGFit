import React from 'react';
import Icon from '../../../components/AppIcon';

const PlanMetrics = ({ metrics, loading = false }) => {
  const metricCards = [
    { title: 'Total Planes', value: metrics?.totalPlans || 0, icon: 'Package', color: 'blue' },
    { title: 'Planes Activos', value: metrics?.activePlans || 0, icon: 'CheckCircle', color: 'emerald' },
    { title: 'Atletas Inscritos', value: metrics?.totalEnrolled || 0, icon: 'Users', color: 'violet' },
    { title: 'Ingresos Mensuales', value: `$${metrics?.monthlyRevenue?.toLocaleString('es-AR') || 0}`, icon: 'TrendingUp', color: 'amber' },
    { title: 'Ocupación Prom.', value: `${metrics?.avgOccupancy || 0}%`, icon: 'BarChart3', color: 'rose' }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
      violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
      rose: { bg: 'bg-rose-50', text: 'text-rose-600' },
    };
    return colors[color] || colors.blue;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm flex flex-col animate-pulse">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 mb-4"></div>
            <div className="space-y-2 mt-auto">
              <div className="h-6 bg-slate-100 rounded w-16"></div>
              <div className="h-3 bg-slate-100 rounded w-24"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {metricCards.map((card, index) => {
        const theme = getColorClasses(card.color);
        
        return (
          <div 
            key={index} 
            className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
          >
            <div className={`w-12 h-12 rounded-2xl ${theme.bg} ${theme.text} flex items-center justify-center shadow-inner mb-4`}>
              <Icon name={card.icon} size={24} />
            </div>
            
            <div className="mt-auto">
              <p className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1.5">
                {card.value}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest line-clamp-1">
                {card.title}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlanMetrics;