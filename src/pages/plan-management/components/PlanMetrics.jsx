import React from 'react';
import Icon from '../../../components/AppIcon';
import { getMetricPalette } from '../../../constants/metricPalettes';
import { Card } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';

const PlanMetrics = ({ metrics, loading = false }) => {
  const metricCards = [
    { title: 'Total Planes', value: metrics?.totalPlans || 0, icon: 'Package', color: 'blue' },
    { title: 'Planes Activos', value: metrics?.activePlans || 0, icon: 'CheckCircle', color: 'emerald' },
    { title: 'Atletas Inscritos', value: metrics?.totalEnrolled || 0, icon: 'Users', color: 'violet' },
    { title: 'Ingresos Mensuales', value: `$${metrics?.monthlyRevenue?.toLocaleString('es-AR') || 0}`, icon: 'TrendingUp', color: 'amber' },
    { title: 'Ocupación Prom.', value: `${metrics?.avgOccupancy || 0}%`, icon: 'BarChart3', color: 'rose' }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} padding="none" className="p-5 flex flex-col">
            <Skeleton className="w-12 h-12 rounded-2xl mb-4" />
            <div className="space-y-2 mt-auto">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {metricCards.map((card, index) => {
        const theme = getMetricPalette(card.color);

        return (
          <Card key={index} padding="none" interactive className="p-5">
            <div className={`w-12 h-12 rounded-2xl ${theme.bg} ${theme.text} flex items-center justify-center shadow-inner mb-4`}>
              <Icon name={card.icon} size={24} />
            </div>

            <div className="mt-auto">
              <p className="text-2xl font-black text-text-primary tracking-tight leading-none mb-1.5">
                {card.value}
              </p>
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest line-clamp-1">
                {card.title}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default PlanMetrics;