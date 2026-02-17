import React from 'react';
import Icon from '../../../components/AppIcon';

// --- SISTEMA DE DISEÑO ---
const THEMES = {
  emerald: { 
    iconBg: 'bg-emerald-50', 
    iconText: 'text-emerald-600', 
    trendUp: 'text-emerald-600 bg-emerald-50',
    border: 'hover:border-emerald-200'
  },
  blue: { 
    iconBg: 'bg-blue-50', 
    iconText: 'text-blue-600', 
    trendUp: 'text-blue-600 bg-blue-50',
    border: 'hover:border-blue-200'
  },
  rose: { 
    iconBg: 'bg-rose-50', 
    iconText: 'text-rose-600', 
    trendDown: 'text-rose-600 bg-rose-50',
    border: 'hover:border-rose-200'
  },
  amber: { 
    iconBg: 'bg-amber-50', 
    iconText: 'text-amber-600', 
    trendNeutral: 'text-amber-600 bg-amber-50',
    border: 'hover:border-amber-200'
  },
  slate: { 
    iconBg: 'bg-slate-50', 
    iconText: 'text-slate-600', 
    border: 'hover:border-slate-200'
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
  let trendClass = 'text-slate-500 bg-slate-50';
  if (isPositive) trendClass = 'text-emerald-600 bg-emerald-50';
  if (isNegative) trendClass = 'text-rose-600 bg-rose-50';
  if (trend === 'neutral') trendClass = 'text-amber-600 bg-amber-50';

  if (loading) {
    return (
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 h-40 flex flex-col justify-between animate-pulse">
        <div className="flex justify-between items-start">
          <div className="space-y-2 w-full">
            <div className="h-3 bg-slate-100 rounded-full w-1/3"></div>
            <div className="h-8 bg-slate-200 rounded-2xl w-2/3"></div>
          </div>
          <div className="h-10 w-10 bg-slate-100 rounded-2xl"></div>
        </div>
        <div className="h-4 bg-slate-50 rounded-full w-1/2 mt-4"></div>
      </div>
    );
  }

  return (
    <div className={`relative bg-white border border-slate-100 rounded-[2.5rem] p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group ${theme.border} ${isAlert ? 'ring-2 ring-rose-100 border-rose-200 bg-rose-50/30' : ''}`}>
      
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
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 pl-1">
          {title}
        </p>
        <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
          {currency && <span className="text-lg text-slate-400 font-bold mr-1 align-top">{currency}</span>}
          {value}
        </h3>
      </div>

      {/* Action / Context Footer */}
      {actionLabel && (
        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between group-hover:border-slate-100 transition-colors">
           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-600 transition-colors cursor-pointer flex items-center gap-1">
             {actionLabel} <Icon name="ArrowRight" size={10} />
           </span>
        </div>
      )}
      
      {/* Alert Decoration */}
      {isAlert && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
      )}
    </div>
  );
};

export default FinancialMetricCard;