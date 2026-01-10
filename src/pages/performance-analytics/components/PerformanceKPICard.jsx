import React from 'react';
import Icon from '../../../components/AppIcon';

const PerformanceKPICard = ({ 
  title, 
  value, 
  unit = '', 
  trend, 
  trendValue, 
  icon, 
  iconColor = 'var(--color-primary)' 
}) => {
  const isPositiveTrend = trend === 'up';
  const trendColor = isPositiveTrend ? 'var(--color-success)' : 'var(--color-error)';

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 transition-smooth hover:shadow-glow-primary">
      <div className="flex items-start justify-between mb-3 md:mb-4">
        <div className="flex-1">
          <p className="text-xs md:text-sm text-muted-foreground mb-1 md:mb-2">{title}</p>
          <div className="flex items-baseline gap-1 md:gap-2">
            <span className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground">
              {value}
            </span>
            {unit && (
              <span className="text-sm md:text-base text-muted-foreground">{unit}</span>
            )}
          </div>
        </div>
        <div className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon name={icon} size={20} color={iconColor} className="md:w-6 md:h-6 lg:w-7 lg:h-7" />
        </div>
      </div>
      
      {trend && (
        <div className="flex items-center gap-1 md:gap-2">
          <Icon 
            name={isPositiveTrend ? 'TrendingUp' : 'TrendingDown'} 
            size={16} 
            color={trendColor}
            className="md:w-5 md:h-5"
          />
          <span className="text-xs md:text-sm font-medium" style={{ color: trendColor }}>
            {trendValue}
          </span>
          <span className="text-xs md:text-sm text-muted-foreground">vs mes anterior</span>
        </div>
      )}
    </div>
  );
};

export default PerformanceKPICard;