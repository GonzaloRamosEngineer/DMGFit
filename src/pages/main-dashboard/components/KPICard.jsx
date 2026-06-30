import React from 'react';
import Icon from '../../../components/AppIcon';
import { Card } from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';

const KPICard = ({
  title,
  value,
  trend,
  trendValue,
  icon,
  threshold = 'green',
  subtitle = '',
  loading = false,
}) => {
  // threshold semántico → tokens de marca (no colores ad-hoc).
  const themes = {
    green: { iconBg: 'bg-success-light', iconText: 'text-success', valText: 'text-text-primary' },
    yellow: { iconBg: 'bg-warning-light', iconText: 'text-warning', valText: 'text-text-primary' },
    red: { iconBg: 'bg-error-light', iconText: 'text-error', valText: 'text-error' },
  };

  const trendConfig = {
    up: { icon: 'TrendingUp', variant: 'success' },
    down: { icon: 'TrendingDown', variant: 'error' },
    neutral: { icon: 'Minus', variant: 'neutral' },
  };

  if (loading) {
    return (
      <Card padding="default" elevation="sm" className="h-40 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-2 w-1/2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
          <Skeleton className="h-12 w-12 rounded-2xl" />
        </div>
        <div className="mt-auto pt-4 border-t border-border">
          <Skeleton className="h-4 w-1/3 rounded-full" />
        </div>
      </Card>
    );
  }

  const currentTheme = themes[threshold] || themes.green;
  const currentTrend = trendConfig[trend] || trendConfig.neutral;

  return (
    <Card padding="default" interactive className="flex flex-col h-full group">
      {/* Encabezado: Título, Valor e Ícono */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] md:text-xs font-bold text-text-tertiary uppercase tracking-widest mb-1.5 truncate">
            {title}
          </p>
          <h3 className={`text-3xl md:text-4xl font-black tracking-tight leading-none ${currentTheme.valText}`}>
            {value}
          </h3>
          {subtitle && (
            <p className="text-[11px] font-medium text-text-tertiary mt-2 truncate">{subtitle}</p>
          )}
        </div>

        <div
          className={`w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-105 ${currentTheme.iconBg} ${currentTheme.iconText}`}
        >
          <Icon name={icon} size={24} />
        </div>
      </div>

      {/* Pie: Tendencia */}
      <div className="mt-auto pt-4 border-t border-border">
        {trendValue ? (
          <Badge variant={currentTrend.variant} size="sm" iconName={currentTrend.icon}>
            {trendValue}
          </Badge>
        ) : (
          <div className="h-[22px]" /> /* Espaciador para mantener la altura */
        )}
      </div>
    </Card>
  );
};

export default KPICard;
