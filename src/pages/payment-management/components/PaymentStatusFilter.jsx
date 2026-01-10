import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const PaymentStatusFilter = ({ activeFilter, onFilterChange, counts }) => {
  const filters = [
    { 
      id: 'all', 
      label: 'Todos', 
      icon: 'CreditCard', 
      count: counts?.all,
      color: 'text-foreground'
    },
    { 
      id: 'current', 
      label: 'Al Día', 
      icon: 'CheckCircle', 
      count: counts?.current,
      color: 'text-success'
    },
    { 
      id: 'overdue', 
      label: 'Vencidos', 
      icon: 'AlertCircle', 
      count: counts?.overdue,
      color: 'text-error'
    },
    { 
      id: 'pending', 
      label: 'Pendientes', 
      icon: 'Clock', 
      count: counts?.pending,
      color: 'text-warning'
    }
  ];

  return (
    <div className="flex flex-wrap gap-2 md:gap-3">
      {filters?.map((filter) => (
        <Button
          key={filter?.id}
          variant={activeFilter === filter?.id ? 'default' : 'outline'}
          size="default"
          onClick={() => onFilterChange(filter?.id)}
          className="flex-1 min-w-[120px] md:min-w-[140px]"
        >
          <Icon 
            name={filter?.icon} 
            size={18} 
            color={activeFilter === filter?.id ? 'currentColor' : `var(--color-${filter?.color?.split('-')?.[1]})` }
            className="mr-2"
          />
          <span className="font-medium">{filter?.label}</span>
          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-data ${
            activeFilter === filter?.id 
              ? 'bg-primary-foreground/20' 
              : 'bg-muted'
          }`}>
            {filter?.count}
          </span>
        </Button>
      ))}
    </div>
  );
};

export default PaymentStatusFilter;