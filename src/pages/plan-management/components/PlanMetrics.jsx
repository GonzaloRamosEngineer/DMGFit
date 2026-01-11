import React from 'react';
import Icon from '../../../components/AppIcon';

const PlanMetrics = ({ metrics, loading = false }) => {
  const metricCards = [
    { title: 'Total Planes', value: metrics?.totalPlans, icon: 'Package', color: 'primary' },
    { title: 'Planes Activos', value: metrics?.activePlans, icon: 'CheckCircle', color: 'success' },
    { title: 'Atletas Inscritos', value: metrics?.totalEnrolled, icon: 'Users', color: 'accent' },
    { title: 'Ingresos Mensuales', value: `$${metrics?.monthlyRevenue?.toLocaleString()}`, icon: 'TrendingUp', color: 'warning' },
    { title: 'Ocupación Promedio', value: `${metrics?.avgOccupancy}%`, icon: 'BarChart3', color: 'secondary' }
  ];

  const colorMap = {
    primary: 'var(--color-primary)',
    success: 'var(--color-success)',
    accent: 'var(--color-accent)',
    warning: 'var(--color-warning)',
    secondary: 'var(--color-secondary)'
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="bg-card border border-border rounded-xl p-6 h-28 animate-pulse bg-muted/20"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {metricCards.map((metric, index) => (
        <div key={index} className="bg-card border border-border rounded-xl p-4 hover:shadow-lg transition-smooth">
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${colorMap[metric.color]}20` }}>
              <Icon name={metric.icon} size={20} color={colorMap[metric.color]} />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{metric.value}</p>
          <p className="text-sm text-muted-foreground">{metric.title}</p>
        </div>
      ))}
    </div>
  );
};

export default PlanMetrics;