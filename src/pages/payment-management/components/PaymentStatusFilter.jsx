import React from 'react';
import Icon from '../../../components/AppIcon';

const PaymentStatusFilter = ({ activeFilter, onFilterChange, counts, loading = false }) => {
  const filters = [
    { id: 'all', label: 'Todos', icon: 'LayoutGrid', color: 'text-slate-600', bg: 'bg-slate-100', activeBg: 'bg-slate-900 text-white' },
    { id: 'current', label: 'Al Día', icon: 'CheckCircle', count: counts?.current, color: 'text-emerald-600', bg: 'bg-emerald-50', activeBg: 'bg-emerald-600 text-white' },
    { id: 'pending', label: 'Pendientes', icon: 'Clock', count: counts?.pending, color: 'text-amber-600', bg: 'bg-amber-50', activeBg: 'bg-amber-500 text-white' },
    { id: 'overdue', label: 'Vencidos', icon: 'AlertCircle', count: counts?.overdue, color: 'text-rose-600', bg: 'bg-rose-50', activeBg: 'bg-rose-600 text-white' }
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-50/50 rounded-2xl border border-slate-100 w-full md:w-auto">
      {filters.map((filter) => {
        const isActive = activeFilter === filter.id;
        
        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            disabled={loading}
            className={`
              relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-300
              ${isActive ? filter.activeBg : `hover:bg-white hover:shadow-sm ${filter.color}`}
              ${loading ? 'opacity-50 cursor-wait' : ''}
            `}
          >
            <Icon name={filter.icon} size={16} className={isActive ? 'text-white' : filter.color} />
            <span>{filter.label}</span>
            
            {/* Counter Badge */}
            {(filter.count !== undefined) && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] leading-none ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200/50 text-slate-500'}`}>
                {loading ? '-' : filter.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PaymentStatusFilter;