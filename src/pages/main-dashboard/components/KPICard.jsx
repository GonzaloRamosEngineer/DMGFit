import React from 'react';
import Icon from '../../../components/AppIcon';

const KPICard = ({ 
  title, 
  value, 
  trend, 
  trendValue, 
  icon, 
  threshold = 'green',
  subtitle = '',
  loading = false 
}) => {
  const thresholdColors = {
    green: 'text-success',
    yellow: 'text-warning',
    red: 'text-error'
  };

  const thresholdBgColors = {
    green: 'bg-success/10',
    yellow: 'bg-warning/10',
    red: 'bg-error/10'
  };

  const trendIcon = trend === 'up' ? 'TrendingUp' : trend === 'down' ? 'TrendingDown' : 'Minus';
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-error' : 'text-muted-foreground';

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 transition-smooth hover:shadow-glow-primary">
      <div className="flex items-start justify-between mb-3 md:mb-4">
        <div className="flex-1">
          <p className="text-xs md:text-sm text-muted-foreground mb-1">{title}</p>
          {loading ? (
            <div className="h-8 md:h-10 bg-muted animate-pulse rounded w-24 md:w-32"></div>
          ) : (
            <h3 className={`text-2xl md:text-3xl lg:text-4xl font-heading font-bold ${thresholdColors?.[threshold]}`}>
              {value}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`${thresholdBgColors?.[threshold]} p-2 md:p-3 rounded-lg`}>
          <Icon name={icon} size={20} color={`var(--color-${threshold === 'green' ? 'success' : threshold === 'yellow' ? 'warning' : 'error'})`} />
        </div>
      </div>
      {trendValue && (
        <div className="flex items-center space-x-2">
          <Icon name={trendIcon} size={16} color={`var(--color-${trend === 'up' ? 'success' : trend === 'down' ? 'error' : 'muted-foreground'})`} />
          <span className={`text-xs md:text-sm font-medium ${trendColor}`}>
            {trendValue}
          </span>
          <span className="text-xs text-muted-foreground">vs mes anterior</span>
        </div>
      )}
    </div>
  );
};

export default KPICard;