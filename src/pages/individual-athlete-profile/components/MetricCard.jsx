import React from 'react';
import Icon from '../../../components/AppIcon';

const MetricCard = ({ title, value, unit, change, changeType, icon, iconColor }) => {
  const isPositive = changeType === 'positive';
  const isNegative = changeType === 'negative';
  const isNeutral = changeType === 'neutral';

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-5 lg:p-6 transition-smooth hover:shadow-glow-primary">
      <div className="flex items-start justify-between mb-3 md:mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm text-muted-foreground mb-1 truncate">{title}</p>
          <div className="flex items-baseline gap-1.5 md:gap-2">
            <span className="text-2xl md:text-3xl lg:text-4xl font-heading font-semibold text-foreground data-text">
              {value}
            </span>
            {unit && (
              <span className="text-sm md:text-base text-muted-foreground">{unit}</span>
            )}
          </div>
        </div>
        <div 
          className="w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${iconColor}20` }}
        >
          <Icon name={icon} size={20} color={iconColor} />
        </div>
      </div>

      {change && (
        <div className="flex items-center gap-1.5">
          <Icon
            name={isPositive ? 'TrendingUp' : isNegative ? 'TrendingDown' : 'Minus'}
            size={16}
            color={isPositive ? 'var(--color-success)' : isNegative ? 'var(--color-error)' : 'var(--color-muted-foreground)'}
          />
          <span className={`text-xs md:text-sm font-medium ${
            isPositive ? 'text-success' : isNegative ? 'text-error' : 'text-muted-foreground'
          }`}>
            {change}
          </span>
          <span className="text-xs md:text-sm text-muted-foreground">vs mes anterior</span>
        </div>
      )}
    </div>
  );
};

export default MetricCard;