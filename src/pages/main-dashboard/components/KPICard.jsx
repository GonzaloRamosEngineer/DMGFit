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
  // Paleta de colores unificada con Tailwind
  const themes = {
    green: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', valText: 'text-slate-800' },
    yellow: { iconBg: 'bg-amber-50', iconText: 'text-amber-500', valText: 'text-slate-800' },
    red: { iconBg: 'bg-rose-50', iconText: 'text-rose-500', valText: 'text-rose-600' } // Si es rojo, el valor también se pinta para alertar
  };

  const trendStyles = {
    up: { icon: 'TrendingUp', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    down: { icon: 'TrendingDown', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
    neutral: { icon: 'Minus', color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-100 rounded-[2rem] p-6 h-40 flex flex-col animate-pulse shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-2 w-1/2">
            <div className="h-3 bg-slate-100 rounded"></div>
            <div className="h-8 bg-slate-100 rounded w-3/4"></div>
          </div>
          <div className="h-12 w-12 bg-slate-100 rounded-2xl"></div>
        </div>
        <div className="mt-auto pt-4 border-t border-slate-50">
          <div className="h-4 bg-slate-100 rounded-full w-1/3"></div>
        </div>
      </div>
    );
  }

  const currentTheme = themes[threshold] || themes.green;
  const currentTrend = trendStyles[trend] || trendStyles.neutral;

  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 transition-all duration-300 hover:shadow-md hover:-translate-y-1 flex flex-col h-full group">
      
      {/* Encabezado: Título, Valor e Ícono */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 truncate">
            {title}
          </p>
          <h3 className={`text-3xl md:text-4xl font-black tracking-tight leading-none ${currentTheme.valText}`}>
            {value}
          </h3>
          {subtitle && (
            <p className="text-[11px] font-medium text-slate-400 mt-2 truncate">
              {subtitle}
            </p>
          )}
        </div>
        
        <div className={`w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-105 ${currentTheme.iconBg} ${currentTheme.iconText}`}>
          <Icon name={icon} size={24} />
        </div>
      </div>

      {/* Pie: Tendencia (Trend Pill) */}
      <div className="mt-auto pt-4 border-t border-slate-100/60">
        {trendValue ? (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${currentTrend.bg} ${currentTrend.color} ${currentTrend.border}`}>
              <Icon name={currentTrend.icon} size={12} strokeWidth={3} />
              {trendValue}
            </span>
          </div>
        ) : (
          <div className="h-[22px]"></div> /* Espaciador si no hay tendencia para mantener la altura */
        )}
      </div>
      
    </div>
  );
};

export default KPICard;