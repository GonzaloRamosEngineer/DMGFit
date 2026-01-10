import React from 'react';
import Icon from '../../../components/AppIcon';

const HealthMetrics = ({ metrics }) => {
  const getMetricIcon = (type) => {
    switch (type) {
      case 'weight':
        return 'Scale';
      case 'height':
        return 'Ruler';
      case 'bmi':
        return 'Activity';
      case 'bodyFat':
        return 'Percent';
      case 'heartRate':
        return 'Heart';
      case 'bloodPressure':
        return 'Droplet';
      default:
        return 'Activity';
    }
  };

  const getMetricColor = (type) => {
    switch (type) {
      case 'weight':
        return 'var(--color-primary)';
      case 'height':
        return 'var(--color-accent)';
      case 'bmi':
        return 'var(--color-secondary)';
      case 'bodyFat':
        return 'var(--color-warning)';
      case 'heartRate':
        return 'var(--color-error)';
      case 'bloodPressure':
        return 'var(--color-success)';
      default:
        return 'var(--color-muted-foreground)';
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <h3 className="text-base md:text-lg font-heading font-semibold text-foreground mb-3 md:mb-4">
        Métricas de Salud
      </h3>
      <div className="grid grid-cols-1 gap-2 md:gap-3">
        {metrics?.map((metric) => (
          <div 
            key={metric?.type}
            className="bg-muted/30 border border-border rounded-lg p-3 md:p-4 transition-smooth hover:bg-muted/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                <div 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${getMetricColor(metric?.type)}20` }}
                >
                  <Icon 
                    name={getMetricIcon(metric?.type)} 
                    size={18} 
                    color={getMetricColor(metric?.type)} 
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-muted-foreground truncate">
                    {metric?.label}
                  </p>
                  <p className="text-base md:text-lg font-semibold text-foreground data-text">
                    {metric?.value} {metric?.unit}
                  </p>
                </div>
              </div>
              {metric?.change && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Icon
                    name={metric?.change > 0 ? 'TrendingUp' : 'TrendingDown'}
                    size={14}
                    color={metric?.change > 0 ? 'var(--color-success)' : 'var(--color-error)'}
                  />
                  <span className={`text-xs md:text-sm font-medium ${
                    metric?.change > 0 ? 'text-success' : 'text-error'
                  }`}>
                    {Math.abs(metric?.change)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 md:p-4 mt-3 md:mt-4">
        <div className="flex items-start gap-2 md:gap-3">
          <Icon name="Info" size={18} color="var(--color-accent)" className="flex-shrink-0 mt-0.5" />
          <p className="text-xs md:text-sm text-foreground">
            Última actualización: {metrics?.[0]?.lastUpdate || 'No disponible'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default HealthMetrics;