import React from 'react';
import Icon from '../../../components/AppIcon';

const PaymentStatusFilter = ({ activeFilter, onFilterChange, counts, loading = false }) => {
  const filters = [
    { id: 'all', label: 'Todos', icon: 'LayoutGrid', color: 'text-text-secondary', bg: 'bg-muted', activeBg: 'bg-primary text-primary-foreground' },
    { id: 'current', label: 'Al Día', icon: 'CheckCircle', count: counts?.current, color: 'text-success', bg: 'bg-success-light', activeBg: 'bg-success text-success-foreground' },
    { id: 'pending', label: 'Pendientes', icon: 'Clock', count: counts?.pending, color: 'text-warning', bg: 'bg-warning-light', activeBg: 'bg-warning text-warning-foreground' },
    { id: 'overdue', label: 'Vencidos', icon: 'AlertCircle', count: counts?.overdue, color: 'text-error', bg: 'bg-error-light', activeBg: 'bg-error text-error-foreground' }
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-1 bg-muted/50 rounded-2xl border border-border w-full md:w-auto">
      {filters.map((filter) => {
        const isActive = activeFilter === filter.id;
        
        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            disabled={loading}
            className={`
              relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-300
              ${isActive ? filter.activeBg : `hover:bg-card hover:shadow-sm ${filter.color}`}
              ${loading ? 'opacity-50 cursor-wait' : ''}
            `}
          >
            <Icon name={filter.icon} size={16} className={isActive ? 'text-white' : filter.color} />
            <span>{filter.label}</span>
            
            {/* Counter Badge */}
            {(filter.count !== undefined) && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] leading-none ${isActive ? 'bg-white/20 text-white' : 'bg-border/50 text-text-secondary'}`}>
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