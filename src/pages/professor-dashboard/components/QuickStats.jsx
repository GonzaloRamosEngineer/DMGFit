import React from 'react';
import Icon from '../../../components/AppIcon';

const QuickStats = ({ totalAthletes, totalPlans, completedSessions, avgAttendance }) => {
  const stats = [
    { title: 'Mis Atletas', value: totalAthletes, icon: 'Users', color: 'var(--color-primary)', bg: 'bg-primary/10' },
    { title: 'Planes Activos', value: totalPlans, icon: 'Package', color: 'var(--color-accent)', bg: 'bg-accent/10' },
    { title: 'Sesiones Completadas', value: completedSessions, icon: 'CheckCircle', color: 'var(--color-success)', bg: 'bg-success/10' },
    { title: 'Asistencia Prom.', value: `${avgAttendance}%`, icon: 'TrendingUp', color: 'var(--color-secondary)', bg: 'bg-secondary/10' }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div key={index} className="bg-card border border-border rounded-xl p-6 transition-smooth hover:shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 ${stat.bg} rounded-lg flex items-center justify-center`}>
              <Icon name={stat.icon} size={24} color={stat.color} />
            </div>
          </div>
          <p className="text-2xl font-heading font-bold text-foreground mb-1">{stat.value}</p>
          <p className="text-sm text-muted-foreground">{stat.title}</p>
        </div>
      ))}
    </div>
  );
};

export default QuickStats;