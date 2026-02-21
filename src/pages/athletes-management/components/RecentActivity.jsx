import React from 'react';
import Icon from '../../../components/AppIcon';

const RecentActivity = ({ activities, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm animate-pulse">
        <div className="h-6 bg-slate-200 rounded-lg w-1/3 mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-3 items-center">
              <div className="w-10 h-10 bg-slate-200 rounded-full shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded-md w-3/4"></div>
                <div className="h-3 bg-slate-200 rounded-md w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
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
    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm">
          <Icon name="Activity" size={20} className="text-slate-700" />
        </div>
        <div>
          <h3 className="font-black text-slate-800 tracking-tight">
            Actividad Reciente
          </h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Últimos movimientos
          </p>
        </div>
      </div>
      
      {/* Lista */}
      <div className="space-y-4 relative z-10">
        {activities?.length > 0 ? (
          activities.map((activity) => {
            const styles = getActivityStyles(activity.type);
            return (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-2xl transition-colors group border border-transparent hover:border-slate-100"
              >
                {/* Avatar o Icono */}
                <div className="shrink-0 relative mt-1">
                  {activity.athleteImage ? (
                    <img
                      src={activity.athleteImage}
                      alt={activity.athleteName}
                      className="w-10 h-10 rounded-full object-cover shadow-sm border border-slate-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 font-bold text-slate-500 text-sm">
                      {activity.athleteName.charAt(0)}
                    </div>
                  )}
                  {/* Badge del tipo de actividad flotante */}
                  <div className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${styles.bg}`}>
                    <Icon name={styles.icon} size={10} className={styles.color} />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-snug">
                    <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {activity.athleteName}
                    </span>
                    {' '}
                    <span className="text-slate-500 font-medium">
                      {activity.description}
                    </span>
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {formatTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <Icon name="Inbox" size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-bold text-slate-500">No hay actividad reciente</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentActivity;