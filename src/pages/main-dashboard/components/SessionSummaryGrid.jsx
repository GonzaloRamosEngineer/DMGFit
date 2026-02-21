import React from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const SessionSummaryGrid = ({ sessions, loading = false }) => {
  
  const getStatusStyle = (status) => {
    const styles = {
      completed: { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Completada', icon: 'CheckCircle' },
      ongoing: { color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'En Curso', icon: 'PlayCircle' },
      scheduled: { color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Programada', icon: 'Clock' },
      cancelled: { color: 'text-rose-600 bg-rose-50 border-rose-200', label: 'Cancelada', icon: 'XCircle' }
    };
    return styles[status] || styles.scheduled;
  };

  const todayStr = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  if (loading) {
    return (
      <div className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 animate-pulse shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div className="space-y-2">
            <div className="h-6 bg-slate-100 rounded w-48"></div>
            <div className="h-3 bg-slate-100 rounded w-32"></div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100"></div>
        </div>
        <div className="space-y-4">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-50 rounded-xl w-full"></div>)}
        </div>
      </div>
    );
  }

  // Definición de las columnas del Grid
  const gridLayout = "grid-cols-[80px_minmax(180px,2fr)_minmax(150px,1.5fr)_120px_100px]";

  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm flex flex-col overflow-hidden">
      
      {/* Cabecera */}
      <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            Agenda de Hoy
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 capitalize">
            {todayStr}
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center shadow-inner">
          <Icon name="Calendar" size={24} />
        </div>
      </div>
      
      {/* Contenedor con Scroll horizontal para pantallas pequeñas */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[700px]">
          
          {/* Encabezados de Columna */}
          <div className={`grid ${gridLayout} gap-4 px-8 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest items-center`}>
            <div>Hora</div>
            <div>Entrenador</div>
            <div>Programa</div>
            <div className="text-center">Asistencia</div>
            <div className="text-center">Estado</div>
          </div>

          {/* Filas */}
          <div className="flex flex-col divide-y divide-slate-100 pb-2">
            {sessions?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                  <Icon name="Coffee" size={28} className="text-slate-300" />
                </div>
                <p className="text-sm font-black text-slate-700 mb-1">Día Libre</p>
                <p className="text-xs font-medium text-slate-400">No hay sesiones programadas para hoy.</p>
              </div>
            ) : (
              sessions.map((session) => {
                const status = getStatusStyle(session.status);
                const occupancyPercentage = session.capacity > 0 ? (session.attendanceCount / session.capacity) * 100 : 0;
                const isFull = occupancyPercentage >= 100;

                return (
                  <div key={session.id} className={`grid ${gridLayout} gap-4 px-8 py-4 items-center hover:bg-slate-50/80 transition-colors group`}>
                    
                    {/* Hora */}
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors"></div>
                      <span className="text-sm font-black text-slate-700">
                        {session.time?.slice(0, 5)}
                      </span>
                    </div>

                    {/* Entrenador */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                        {session.coachAvatar ? (
                          <Image src={session.coachAvatar} alt={session.coachName} className="w-full h-full object-cover" />
                        ) : (
                          <Icon name="User" size={16} className="text-slate-400" />
                        )}
                      </div>
                      <span className="text-sm font-bold text-slate-800 truncate">
                        {session.coachName}
                      </span>
                    </div>

                    {/* Programa */}
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg truncate">
                        {session.program}
                      </span>
                    </div>

                    {/* Asistencia (Barra y Texto) */}
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="flex items-center gap-1 mb-1">
                        <span className={`text-sm font-black ${isFull ? 'text-rose-500' : 'text-slate-800'}`}>
                          {session.attendanceCount}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          / {session.capacity}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-rose-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Estado */}
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${status.color}`}>
                        <Icon name={status.icon} size={10} />
                        {status.label}
                      </span>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default SessionSummaryGrid;