import React from 'react';
import Icon from '../../../components/AppIcon';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';

const RecentActivity = ({ activities, loading = false }) => {
  if (loading) {
    return (
      <Card padding="default">
        <Skeleton className="h-6 w-1/3 mb-6 rounded-lg" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-3 items-center">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-1/3 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // --- Helpers visuales estilo SaaS ---
  const getActivityStyles = (type) => {
    switch (type) {
      case 'registration': 
        return { icon: 'UserPlus', color: 'text-emerald-600', bg: 'bg-emerald-100' };
      case 'payment': 
        return { icon: 'DollarSign', color: 'text-blue-600', bg: 'bg-blue-100' };
      case 'session': 
        return { icon: 'CalendarCheck', color: 'text-indigo-600', bg: 'bg-indigo-100' };
      case 'achievement': 
        return { icon: 'Award', color: 'text-amber-600', bg: 'bg-amber-100' };
      default: 
        return { icon: 'Activity', color: 'text-slate-500', bg: 'bg-slate-100' };
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - activityTime) / (1000 * 60));

    if (diffInMinutes < 1) return 'Ahora mismo';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
    if (diffInMinutes < 1440) return `Hace ${Math.floor(diffInMinutes / 60)} hs`;
    return `Hace ${Math.floor(diffInMinutes / 1440)} días`;
  };

  return (
    <Card padding="default" className="relative shrink-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 relative z-card">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center border border-border shadow-sm">
          <Icon name="Activity" size={20} className="text-text-secondary" />
        </div>
        <div>
          <h3 className="font-black text-text-primary tracking-tight">
            Actividad Reciente
          </h3>
          <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mt-0.5">
            Últimos movimientos
          </p>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-4 relative z-card">
        {activities?.length > 0 ? (
          activities.map((activity) => {
            const styles = getActivityStyles(activity.type);
            return (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-3 hover:bg-muted rounded-2xl transition-colors group border border-transparent hover:border-border"
              >
                {/* Avatar o Icono */}
                <div className="shrink-0 relative mt-1">
                  {activity.athleteImage ? (
                    <img
                      src={activity.athleteImage}
                      alt={activity.athleteName}
                      className="w-10 h-10 rounded-full object-cover shadow-sm border border-border"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border font-bold text-text-secondary text-sm">
                      {activity.athleteName.charAt(0)}
                    </div>
                  )}
                  {/* Badge del tipo de actividad flotante */}
                  <div className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-full border-2 border-card flex items-center justify-center ${styles.bg}`}>
                    <Icon name={styles.icon} size={10} className={styles.color} />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-secondary leading-snug">
                    <span className="font-bold text-text-primary group-hover:text-primary transition-colors">
                      {activity.athleteName}
                    </span>
                    {' '}
                    <span className="text-text-secondary font-medium">
                      {activity.description}
                    </span>
                  </p>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-1">
                    {formatTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState iconName="Inbox" title="No hay actividad reciente" />
        )}
      </div>
    </Card>
  );
};

export default RecentActivity;