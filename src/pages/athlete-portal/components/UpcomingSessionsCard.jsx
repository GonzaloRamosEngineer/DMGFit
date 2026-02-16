import React, { useMemo } from 'react';
import Icon from '../../../components/AppIcon';

// --- UTILS & CONFIG ---

// Detecta el tipo de sesión para asignar colores e iconos
const getSessionTheme = (type = '') => {
  const t = type.toLowerCase();
  if (t.includes('yoga') || t.includes('flex')) return { color: 'text-emerald-500', bg: 'bg-emerald-500', gradient: 'from-emerald-500 to-teal-600', icon: 'Feather' };
  if (t.includes('cross') || t.includes('hiit')) return { color: 'text-orange-500', bg: 'bg-orange-500', gradient: 'from-orange-500 to-red-600', icon: 'Zap' };
  if (t.includes('fuerza') || t.includes('strength')) return { color: 'text-slate-800', bg: 'bg-slate-800', gradient: 'from-slate-700 to-slate-900', icon: 'Anchor' };
  // Default (Blue)
  return { color: 'text-blue-600', bg: 'bg-blue-600', gradient: 'from-blue-600 to-indigo-600', icon: 'Activity' };
};

// Formatea la fecha de forma inteligente (Hoy, Mañana, Vie 24)
const getSmartDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()); // Sin hora

  const diffDays = Math.round((itemDate - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: 'HOY', sub: 'Prepárate' };
  if (diffDays === 1) return { label: 'MAÑANA', sub: 'Próximamente' };
  
  // Si no es hoy/mañana: "VIE 24"
  const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).toUpperCase();
  const dayNum = date.getDate();
  return { label: dayName, sub: dayNum }; // ej: Label: VIE, Sub: 24
};

// --- SUB-COMPONENTS ---

const NextSessionHero = ({ session }) => {
  const theme = getSessionTheme(session.type);
  const dateInfo = getSmartDate(session.date);

  return (
    <div className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-blue-900/10 group`}>
      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} transition-transform duration-500 group-hover:scale-105`}></div>
      
      {/* Decorative Circles */}
      <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-24 h-24 bg-black opacity-10 rounded-full blur-xl"></div>

      <div className="relative z-10 flex flex-col h-full justify-between min-h-[160px]">
        {/* Header: Badge & Time */}
        <div className="flex justify-between items-start">
          <div className="bg-white/20 backdrop-blur-md border border-white/20 px-3 py-1 rounded-lg">
             <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
               {dateInfo.label}
             </span>
          </div>
          <div className="text-right">
             <h2 className="text-3xl font-black tracking-tighter leading-none">{session.time}</h2>
             <p className="text-[9px] font-bold uppercase tracking-widest opacity-80 mt-0.5">Inicio</p>
          </div>
        </div>

        {/* Body: Session Name */}
        <div className="mt-4">
           <div className="flex items-center gap-2 mb-1 opacity-80">
              <Icon name={theme.icon} size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{session.type}</span>
           </div>
           <h3 className="text-2xl font-black italic tracking-tight leading-tight">
             {session.title || session.type} {/* Fallback si no hay título específico */}
           </h3>
        </div>

        {/* Footer: Coach & Location */}
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-end">
           <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-xs border border-white/10">
                 {session.professor ? session.professor.charAt(0) : 'C'}
              </div>
              <div>
                 <p className="text-[9px] font-bold uppercase opacity-60 tracking-wider">Coach</p>
                 <p className="text-xs font-bold">{session.professor}</p>
              </div>
           </div>
           <div className="text-right">
              <p className="text-[9px] font-bold uppercase opacity-60 tracking-wider flex items-center justify-end gap-1">
                 <Icon name="MapPin" size={10} /> Ubicación
              </p>
              <p className="text-xs font-bold">{session.location}</p>
           </div>
        </div>
      </div>
    </div>
  );
};

const FutureSessionRow = ({ session }) => {
  const theme = getSessionTheme(session.type);
  const dateInfo = getSmartDate(session.date);

  return (
    <div className="group flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl transition-colors border border-transparent hover:border-slate-100">
      {/* Date Block */}
      <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white group-hover:shadow-sm transition-all">
         <span className="text-[9px] font-black text-slate-400 uppercase leading-none">{dateInfo.label.substring(0,3)}</span>
         <span className="text-lg font-black text-slate-800 leading-none mt-0.5">{typeof dateInfo.sub === 'number' ? dateInfo.sub : '•'}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
         <div className="flex justify-between items-center mb-0.5">
            <h4 className="font-bold text-slate-800 text-sm truncate">{session.type}</h4>
            <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
               {session.time}
            </span>
         </div>
         <div className="flex items-center gap-3">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
               <span className={`w-1.5 h-1.5 rounded-full ${theme.bg}`}></span>
               {session.professor}
            </p>
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
               <Icon name="MapPin" size={8} />
               {session.location}
            </p>
         </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const UpcomingSessionsCard = ({ sessions }) => {
  // Ordenar cronológicamente
  const sortedSessions = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort((a, b) => {
      // Combinar fecha y hora para ordenar correctamente
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA - dateB;
    });
  }, [sessions]);

  const nextSession = sortedSessions[0];
  const futureSessions = sortedSessions.slice(1);

  if (!sortedSessions.length) {
     return (
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 h-full flex flex-col items-center justify-center text-center opacity-70">
           <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-dashed border-slate-200">
              <Icon name="Coffee" className="text-slate-400" size={24} />
           </div>
           <h3 className="text-slate-900 font-black text-sm uppercase tracking-wide">Día de Descanso</h3>
           <p className="text-xs text-slate-400 mt-2 max-w-[200px] leading-relaxed">
              No tienes sesiones programadas próximamente. ¡Aprovecha para recuperar energía!
           </p>
           <button className="mt-6 px-5 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors">
              Agendar Clase
           </button>
        </div>
     );
  }

  return (
    <div className="bg-white rounded-[2.5rem] p-6 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] border border-slate-100 h-full flex flex-col">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pl-2 pr-2">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
           <Icon name="Calendar" className="text-blue-600" size={20} />
           Agenda
        </h2>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">
           {sortedSessions.length} Activas
        </span>
      </div>

      {/* 1. Next Session (Hero Card) */}
      <div className="mb-6">
         <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3 ml-2">
            Próxima Sesión
         </p>
         <NextSessionHero session={nextSession} />
      </div>

      {/* 2. Future List */}
      {futureSessions.length > 0 && (
         <div className="flex-1 overflow-y-auto pr-1 -mr-1 max-h-[250px] scrollbar-hide">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2 ml-2 sticky top-0 bg-white z-10 py-1">
               Próximamente
            </p>
            <div className="space-y-1">
               {futureSessions.map((session, idx) => (
                  <FutureSessionRow key={idx} session={session} />
               ))}
            </div>
         </div>
      )}

    </div>
  );
};

export default UpcomingSessionsCard;