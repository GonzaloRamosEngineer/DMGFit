import React from 'react';
import Icon from '../../../components/AppIcon';

const PerformanceKPICard = ({ 
  title, 
  value, 
  unit = '', 
  trend, 
  trendValue, 
  icon, 
  iconColor = 'var(--color-primary)',
  loading = false // Nuevo prop para manejar la carga
}) => {
  const isPositiveTrend = trend === 'up';
  const trendColor = isPositiveTrend ? 'var(--color-success)' : 'var(--color-error)';

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 h-full flex flex-col justify-between animate-pulse">
        <div className="flex justify-between mb-4">
          <div className="h-4 bg-muted/50 rounded w-1/2"></div>
          <div className="w-10 h-10 bg-muted/50 rounded-lg"></div>
        </div>
        <div>
          <div className="h-8 bg-muted/50 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-muted/50 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 transition-smooth hover:shadow-glow-primary h-full">
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
          <span className="text-xs md:text-sm text-muted-foreground">vs periodo anterior</span>
        </div>
      )}
      
      {!trend && (
        <div className="h-5 md:h-6"></div> // Espaciador para mantener altura consistente
      )}
    </div>
  );
};

export default PerformanceKPICard;