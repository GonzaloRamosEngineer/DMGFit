import React from 'react';
import Icon from '../../../components/AppIcon';

const MetricsStrip = ({ metrics }) => {
  const metricCards = [
    {
      id: 'total',
      label: 'Total Atletas',
      value: metrics?.totalAthletes,
      icon: 'Users',
      trend: '+12',
      trendDirection: 'up',
      sparklineData: [45, 52, 48, 61, 58, 65, 68]
    },
    {
      id: 'active',
      label: 'Activos Este Mes',
      value: metrics?.activeThisMonth,
      icon: 'Activity',
      trend: '+8',
      trendDirection: 'up',
      sparklineData: [32, 38, 35, 42, 45, 48, 52]
    },
    {
      id: 'performance',
      label: 'Rendimiento Promedio',
      value: `${metrics?.avgPerformance}%`,
      icon: 'TrendingUp',
      trend: '+5%',
      trendDirection: 'up',
      sparklineData: [72, 75, 73, 78, 80, 82, 85]
    },
    {
      id: 'retention',
      label: 'Tasa de Retención',
      value: `${metrics?.retentionRate}%`,
      icon: 'Target',
      trend: '-2%',
      trendDirection: 'down',
      sparklineData: [88, 90, 89, 87, 86, 85, 84]
    }
  ];

  const renderSparkline = (data) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min;
    const width = 60;
    const height = 20;
    
    const points = data?.map((value, index) => {
      const x = (index / (data?.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })?.join(' ');

    return (
      <svg width={width} height={height} className="opacity-50">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
      {metricCards?.map((card) => (
        <div
          key={card?.id}
          className="bg-card border border-border rounded-lg p-4 md:p-6 transition-smooth hover:shadow-glow-primary"
        >
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name={card?.icon} size={20} color="var(--color-primary)" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground mb-1">{card?.label}</p>
                <p className="text-xl md:text-2xl lg:text-3xl font-heading font-bold text-foreground">
                  {card?.value}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span
                className={`text-xs md:text-sm font-medium ${
                  card?.trendDirection === 'up' ? 'text-success' : 'text-error'
                }`}
              >
                {card?.trend}
              </span>
              <Icon
                name={card?.trendDirection === 'up' ? 'TrendingUp' : 'TrendingDown'}
                size={14}
                color={card?.trendDirection === 'up' ? 'var(--color-success)' : 'var(--color-error)'}
              />
            </div>
            <div className="text-primary">
              {renderSparkline(card?.sparklineData)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MetricsStrip;