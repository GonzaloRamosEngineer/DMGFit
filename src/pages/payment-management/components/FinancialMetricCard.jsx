import React from 'react';
import Icon from '../../../components/AppIcon';

const FinancialMetricCard = ({ 
  title, 
  value, 
  currency, 
  trend, 
  trendValue, 
  icon, 
  iconColor,
  loading = false // Nueva prop
}) => {
  const isPositive = trend === 'up';
  const trendColor = isPositive ? 'text-success' : trend === 'down' ? 'text-error' : 'text-muted-foreground';
  const trendIcon = isPositive ? 'TrendingUp' : trend === 'down' ? 'TrendingDown' : 'Minus';

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 h-32 flex flex-col justify-between animate-pulse">
        <div className="flex justify-between">
          <div className="h-4 bg-muted/50 rounded w-1/2"></div>
          <div className="h-10 w-10 bg-muted/50 rounded-lg"></div>
        </div>
        <div>
          <div className="h-8 bg-muted/50 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-muted/50 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 transition-smooth hover:shadow-glow-primary">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-sm md:text-base text-muted-foreground mb-1">{title}</p>
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground">
            {currency && <span className="text-xl md:text-2xl lg:text-3xl mr-1">{currency}</span>}
            {value}
          </h3>
        </div>
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon name={icon} size={24} color="currentColor" />
        </div>
      </div>
      
      {trendValue && (
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <Icon name={trendIcon} size={16} />
            <span className="text-sm font-medium font-data">{trendValue}</span>
          </div>
          <span className="text-xs text-muted-foreground">vs mes anterior</span>
        </div>
      )}
    </div>
  );
};

export default FinancialMetricCard;