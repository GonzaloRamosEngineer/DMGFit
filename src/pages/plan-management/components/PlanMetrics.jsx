import React from 'react';
import StatCard from '../../../components/ui/StatCard';

const PlanMetrics = ({ metrics, loading = false }) => {
  const metricCards = [
    {
      id: 'active',
      label: 'Planes activos',
      value: metrics?.activePlans || 0,
      subtitle: `De ${metrics?.totalPlans || 0} en total`,
      icon: 'Package',
      tone: 'neutral',
      info: 'Planes que hoy se pueden vender y usar. Los demás están pausados o archivados.',
    },
    {
      id: 'enrolled',
      label: 'Atletas inscriptos',
      value: metrics?.totalEnrolled || 0,
      subtitle: 'Sumando todos los planes',
      icon: 'Users',
      tone: 'neutral',
      info: 'Cuántos atletas tienen asignado alguno de estos planes.',
    },
    {
      id: 'revenue',
      label: 'Ingreso mensual estimado',
      value: `$${metrics?.monthlyRevenue?.toLocaleString('es-AR') || 0}`,
      subtitle: 'Si todos pagan su plan',
      icon: 'TrendingUp',
      tone: 'success',
      info: 'Lo que se cobraría en el mes si cada atleta paga el precio de su plan. Es una estimación: la plata realmente cobrada se ve en Caja y Cobros.',
    },
    {
      id: 'occupancy',
      label: 'Ocupación promedio',
      value: `${metrics?.avgOccupancy || 0}%`,
      subtitle: 'Lugares ocupados',
      icon: 'BarChart3',
      tone: 'neutral',
      info: 'Qué tan llenos están los horarios: inscriptos sobre cupos disponibles. 100% significa que no queda lugar.',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {loading
        ? [1, 2, 3, 4].map((i) => <StatCard key={i} loading />)
        : metricCards.map((card) => <StatCard key={card.id} {...card} />)}
    </div>
  );
};

export default PlanMetrics;
