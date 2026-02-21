import React from 'react';
import Icon from '../../../components/AppIcon';

const MetricsStrip = ({ metrics, loading }) => {
  const metricCards = [
    {
      id: 'total',
      label: 'Total Atletas',
      value: metrics?.totalAthletes || 0,
      icon: 'Users',
      color: 'blue',
      trend: '+12',
      trendDirection: 'up',
      sparklineData: [45, 52, 48, 61, 58, 65, 68]
    },
    {
      id: 'active',
      label: 'Activos Este Mes',
      value: metrics?.activeThisMonth || 0,
      icon: 'Activity',
      color: 'emerald',
      trend: '+8',
      trendDirection: 'up',
      sparklineData: [32, 38, 35, 42, 45, 48, 52]
    },
    {
      id: 'performance',
      label: 'Rendimiento Prom. (Mes)',
      value: `${metrics?.avgPerformance || 0}`,
      icon: 'TrendingUp',
      color: 'violet',
      trend: '+5%',
      trendDirection: 'up',
      sparklineData: [72, 75, 73, 78, 80, 82, 85]
    },
    {
      id: 'retention',
      label: 'Tasa de Retención',
      value: `${metrics?.retentionRate || 0}%`,
      icon: 'Target',
      color: 'amber',
      trend: '-2%',
      trendDirection: 'down',
      sparklineData: [88, 90, 89, 87, 86, 85, 84]
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', stroke: 'stroke-blue-400' },
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', stroke: 'stroke-emerald-400' },
      violet: { bg: 'bg-violet-50', text: 'text-violet-600', stroke: 'stroke-violet-400' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-600', stroke: 'stroke-amber-400' },
    };
    return colors[color] || colors.blue;
  };

  const renderSparkline = (data, colorTheme) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1; // Evitar división por cero
    const width = 60;
    const height = 24;
    
    const points = data?.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          className={colorTheme.stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col gap-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100"></div>
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-slate-100 rounded w-24"></div>
                <div className="h-6 bg-slate-100 rounded w-16"></div>
              </div>
            </div>
            <div className="flex justify-between items-center mt-2">
              <div className="h-4 bg-slate-100 rounded w-12"></div>
              <div className="h-6 bg-slate-100 rounded w-16"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {metricCards.map((card) => {
        const colorTheme = getColorClasses(card.color);
        const isUp = card.trendDirection === 'up';

        return (
          <div
            key={card.id}
            className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex items-center space-x-4 mb-5">
              <div className={`w-12 h-12 rounded-2xl ${colorTheme.bg} ${colorTheme.text} flex items-center justify-center shadow-inner`}>
                <Icon name={card.icon} size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {card.label}
                </p>
                <p className="text-2xl font-black text-slate-800 tracking-tight">
                  {card.value}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                <Icon
                  name={isUp ? 'TrendingUp' : 'TrendingDown'}
                  size={12}
                  strokeWidth={3}
                />
                {card.trend}
              </div>
              <div className="opacity-80">
                {renderSparkline(card.sparklineData, colorTheme)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MetricsStrip;