import React from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const RecentActivity = ({ activities, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 animate-pulse">
        <div className="h-6 bg-muted/50 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-10 h-10 bg-muted/50 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted/50 rounded w-3/4"></div>
                <div className="h-3 bg-muted/50 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getActivityIcon = (type) => {
    switch (type) {
      case 'registration': return 'UserPlus';
      case 'payment': return 'CreditCard';
      case 'session': return 'Calendar';
      case 'achievement': return 'Award';
      case 'message': return 'MessageSquare';
      default: return 'Activity';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'registration': return 'var(--color-success)';
      case 'payment': return 'var(--color-warning)';
      case 'session': return 'var(--color-accent)';
      case 'achievement': return 'var(--color-secondary)';
      case 'message': return 'var(--color-primary)';
      default: return 'var(--color-muted-foreground)';
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - activityTime) / (1000 * 60));

    if (diffInMinutes < 1) return 'Ahora mismo';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
    if (diffInMinutes < 1440) return `Hace ${Math.floor(diffInMinutes / 60)} h`;
    return `Hace ${Math.floor(diffInMinutes / 1440)} días`;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h3 className="text-base md:text-lg font-heading font-semibold text-foreground">
          Actividad Reciente
        </h3>
        <Icon name="Clock" size={20} color="var(--color-primary)" />
      </div>
      
      <div className="space-y-4">
        {activities?.length > 0 ? (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 pb-4 border-b border-border last:border-b-0 last:pb-0"
            >
              <div className="flex-shrink-0">
                {activity.athleteImage ? (
                  <Image
                    src={activity.athleteImage}
                    alt={activity.athleteName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon
                      name={getActivityIcon(activity.type)}
                      size={18}
                      color={getActivityColor(activity.type)}
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground mb-1">
                  <span className="font-medium">{activity.athleteName}</span>
                  {' '}
                  <span className="text-muted-foreground">{activity.description}</span>
                </p>
                <p className="text-xs text-muted-foreground">{formatTimeAgo(activity.timestamp)}</p>
              </div>

              <Icon
                name={getActivityIcon(activity.type)}
                size={16}
                color={getActivityColor(activity.type)}
                className="flex-shrink-0 opacity-70"
              />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No hay actividad reciente.</p>
        )}
      </div>
      
      {activities?.length > 0 && (
        <button className="w-full mt-4 md:mt-6 py-2 text-sm text-primary hover:text-primary/80 transition-smooth font-medium">
          Ver Todas las Actividades
        </button>
      )}
    </div>
  );
};

export default RecentActivity;