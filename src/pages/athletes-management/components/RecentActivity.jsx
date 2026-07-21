import React from 'react';
import Icon from '../../../components/AppIcon';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';

const RecentActivity = ({ activities, loading = false }) => {
  // Arranca colapsado para no saturar la pantalla; la cabecera lo despliega.
  const [expanded, setExpanded] = React.useState(false);

  if (loading) {
    return (
      <Card padding="default">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-2/3 rounded-md mt-5" />
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

  const activityList = activities || [];
  const hasData = activityList.length > 0;
  const latest = activityList[0];

  const renderActivity = (activity) => {
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
  };

  return (
    <Card padding="default" className="relative shrink-0">
      {/* Cabecera: botón que despliega / colapsa */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 text-left relative z-card"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center border border-border shadow-sm shrink-0">
            <Icon name="Activity" size={20} className="text-text-secondary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-text-primary tracking-tight truncate">
              Actividad Reciente
            </h3>
            <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mt-0.5 truncate">
              Últimos movimientos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {hasData && (
            <span
              className="inline-flex items-center justify-center min-w-[2.25rem] h-9 px-2.5 rounded-xl bg-muted border border-border text-base font-black text-text-primary"
              title={`${activityList.length} movimientos recientes`}
            >
              {activityList.length}
            </span>
          )}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary bg-muted/60">
            <Icon
              name="ChevronDown"
              size={18}
              className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </button>

      {/* Peek de la última actividad (colapsado) */}
      {!expanded && (
        <div className="mt-5 flex items-center gap-2 text-xs min-w-0 relative z-card">
          {hasData ? (
            <>
              {(() => {
                const styles = getActivityStyles(latest.type);
                return (
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${styles.bg}`}>
                    <Icon name={styles.icon} size={11} className={styles.color} />
                  </div>
                );
              })()}
              <span className="font-bold text-text-primary truncate">{latest.athleteName}</span>
              <span className="text-text-tertiary truncate">{latest.description}</span>
              <span className="ml-auto text-[10px] font-bold text-text-tertiary uppercase tracking-widest shrink-0">
                {formatTimeAgo(latest.timestamp)}
              </span>
            </>
          ) : (
            <span className="text-text-tertiary font-medium">Sin actividad reciente</span>
          )}
        </div>
      )}

      {/* Lista completa (desplegable) */}
      {expanded && (
        <div className="mt-4 space-y-4 relative z-card animate-in fade-in slide-in-from-top-2 duration-300">
          {hasData ? (
            activityList.map((activity) => renderActivity(activity))
          ) : (
            <EmptyState iconName="Inbox" title="No hay actividad reciente" />
          )}
        </div>
      )}
    </Card>
  );
};

export default RecentActivity;
