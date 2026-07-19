import React from 'react';
import StatCard from '../../../components/ui/StatCard';

const MetricsStrip = ({ metrics, loading }) => {
  const pendingCount = Math.max(
    0,
    (metrics?.totalAthletes || 0) - (metrics?.upToDateCount || 0),
  );

  const metricCards = [
    {
      id: 'total',
      label: 'Total de atletas',
      value: metrics?.totalAthletes || 0,
      subtitle: 'Registrados en el sistema',
      icon: 'Users',
      tone: 'neutral',
      info: 'Todos los atletas cargados en el sistema, estén activos o no.',
    },
    {
      id: 'active',
      label: 'Activos',
      value: metrics?.activeThisMonth || 0,
      subtitle: 'Con membresía vigente',
      icon: 'Activity',
      tone: 'success',
      info: 'Atletas con la membresía vigente. Los inactivos no pueden entrar al gimnasio.',
    },
    {
      id: 'new',
      label: 'Nuevos este mes',
      value: metrics?.newThisMonth || 0,
      subtitle: 'Se sumaron al gimnasio',
      icon: 'UserPlus',
      tone: 'neutral',
      info: 'Atletas que se dieron de alta durante este mes.',
    },
    {
      id: 'uptodate',
      label: 'Al día con la cuota',
      value: metrics?.upToDateCount || 0,
      subtitle: pendingCount > 0 ? `${pendingCount} con pagos pendientes` : 'Nadie debe',
      icon: 'CheckCircle',
      tone: pendingCount > 0 ? 'warning' : 'success',
      info: 'Atletas cuyo último pago figura como cobrado. El resto tiene una cuota pendiente o vencida (se cobra desde Caja y Cobros).',
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

export default MetricsStrip;
