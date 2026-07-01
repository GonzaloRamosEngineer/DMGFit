import React from 'react';
import Icon from '../../../components/AppIcon';

// --- SISTEMA DE DISEÑO ---
const THEMES = {
  emerald: {
    iconBg: 'bg-success-light',
    iconText: 'text-success',
    trendUp: 'text-success bg-success-light',
    border: 'hover:border-success/20'
  },
  blue: {
    iconBg: 'bg-info-light',
    iconText: 'text-primary',
    trendUp: 'text-primary bg-info-light',
    border: 'hover:border-primary/20'
  },
  rose: {
    iconBg: 'bg-error-light',
    iconText: 'text-error',
    trendDown: 'text-error bg-error-light',
    border: 'hover:border-error/20'
  },
  amber: {
    iconBg: 'bg-warning-light',
    iconText: 'text-warning',
    trendNeutral: 'text-warning bg-warning-light',
    border: 'hover:border-warning/20'
  },
  slate: {
    iconBg: 'bg-muted',
    iconText: 'text-text-secondary',
    border: 'hover:border-border'
  }
};

const FinancialMetricCard = ({ 
  title, 
  value, 
  currency, 
  trend, 
  trendValue, 
  icon, 
  color = 'slate', // emerald, blue, rose, amber
  actionLabel,
  loading = false,
  isAlert = false
}) => {
  
  const theme = THEMES[color] || THEMES.slate;
  
  // Lógica de Icono de Tendencia
  const isPositive = trend === 'up';
  const isNegative = trend === 'down';
  const TrendIconName = isPositive ? 'TrendingUp' : isNegative ? 'TrendingDown' : 'Minus';
  
  // Color de la píldora de tendencia
  let trendClass = 'text-text-secondary bg-muted';
  if (isPositive) trendClass = 'text-success bg-success-light';
  if (isNegative) trendClass = 'text-error bg-error-light';
  if (trend === 'neutral') trendClass = 'text-warning bg-warning-light';

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 h-40 flex flex-col justify-between animate-pulse">
        <div className="flex justify-between items-start">
          <div className="space-y-2 w-full">
            <div className="h-3 bg-muted rounded-full w-1/3"></div>
            <div className="h-8 bg-muted rounded-2xl w-2/3"></div>
          </div>
          <div className="h-10 w-10 bg-muted rounded-2xl"></div>
        </div>
        <div className="h-4 bg-muted rounded-full w-1/2 mt-4"></div>
      </div>
    );
  }

  return (
    <div className={`relative bg-card border border-border rounded-3xl p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group ${theme.border} ${isAlert ? 'ring-2 ring-error/10 border-error/20 bg-error-light/30' : ''}`}>
      
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${theme.iconBg} ${theme.iconText}`}>
          <Icon name={icon} size={22} />
        </div>
        
        {/* Trend Pill */}
        {trendValue && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${trendClass}`}>
            <Icon name={TrendIconName} size={12} />
            <span>{trendValue}</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div>
        <p className="text-[10px] font-black text-text-tertiary uppercase tracking-[0.2em] mb-1 pl-1">
          {title}
        </p>
        <h3 className="text-3xl font-black text-text-primary tracking-tighter leading-none">
          {currency && <span className="text-lg text-text-tertiary font-bold mr-1 align-top">{currency}</span>}
          {value}
        </h3>
      </div>

      {/* Action / Context Footer */}
      {actionLabel && (
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between group-hover:border-border transition-colors">
           <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest group-hover:text-primary transition-colors cursor-pointer flex items-center gap-1">
             {actionLabel} <Icon name="ArrowRight" size={10} />
           </span>
        </div>
      )}

      {/* Alert Decoration */}
      {isAlert && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-error rounded-full animate-pulse"></div>
      )}
    </div>
  );
};

export default FinancialMetricCard;