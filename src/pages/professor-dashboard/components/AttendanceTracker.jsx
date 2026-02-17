import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';

const AttendanceTracker = ({ sessions, selectedDate }) => {
  // Estado local para UI rápida (Optimistic UI)
  const [loadingMap, setLoadingMap] = useState({}); // { sessionId: true/false }
  const [attendeesMap, setAttendeesMap] = useState({}); // { sessionId: [athletes...] }
  
  // 1. Cargar Participantes cuando cambian las sesiones
  useEffect(() => {
    const fetchAttendees = async () => {
      if (!sessions || sessions.length === 0) return;

      const newAttendeesMap = {};

      for (const session of sessions) {
        // Buscar en la tabla de unión session_attendees para saber quién está inscrito
        // Y hacer join con athletes y attendance para saber el estado actual
        const { data, error } = await supabase
          .from('session_attendees')
          .select(`
            athlete_id,
            athletes:athlete_id ( id, profiles:profile_id(full_name, avatar_url) ),
            attendance:athlete_id ( status ) 
          `)
          .eq('session_id', session.id);
          // Nota: El join con attendance es truculento aquí si hay múltiples fechas.
          // Para hacerlo simple y robusto en V1, haremos fetch separado de attendance.
        
        if (!error && data) {
           // Fetch status real de la tabla attendance para esta sesión específica
           const { data: attData } = await supabase
             .from('attendance')
             .select('athlete_id, status')
             .eq('session_id', session.id)
             .eq('attendance_date', selectedDate); // Importante la fecha!

           const statusMap = {};
           attData?.forEach(a => statusMap[a.athlete_id] = a.status);

           newAttendeesMap[session.id] = data.map(item => ({
             id: item.athlete_id,
             name: item.athletes?.profiles?.full_name || 'Atleta',
             avatar: item.athletes?.profiles?.avatar_url,
             status: statusMap[item.athlete_id] || 'pending' // pending | present | absent | late
           }));
        }
      }
      setAttendeesMap(newAttendeesMap);
    };

    fetchAttendees();
  }, [sessions, selectedDate]);

  // 2. Manejar Click en Asistencia (Guardado en tiempo real)
  const handleStatusChange = async (sessionId, athleteId, newStatus) => {
    // A) Actualización Optimista (UI instantánea)
    setAttendeesMap(prev => ({
      ...prev,
      [sessionId]: prev[sessionId].map(a => 
        a.id === athleteId ? { ...a, status: newStatus } : a
      )
    }));

    // B) Guardado en DB (Upsert)
    try {
      const { error } = await supabase
        .from('attendance')
        .upsert({
          session_id: sessionId,
          athlete_id: athleteId,
          attendance_date: selectedDate,
          status: newStatus,
          date: selectedDate // Campo duplicado por redundancia en tu esquema
        }, { onConflict: 'session_id, athlete_id, attendance_date' }); // Asegúrate de tener este constraint en BD o usar ID si lo conoces

      if (error) throw error;
    } catch (err) {
      console.error("Error guardando asistencia:", err);
      // Aquí podrías revertir el estado si falla
    }
  };

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
        <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
           <Icon name="CalendarOff" className="text-slate-300" size={32} />
        </div>
        <h3 className="text-slate-900 font-bold text-lg">Día Libre</h3>
        <p className="text-slate-400 text-sm">No tienes sesiones programadas para hoy.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sessions.map(session => {
        const attendees = attendeesMap[session.id] || [];
        const isFuture = new Date(`${session.session_date}T${session.time}`) > new Date();

        return (
          <div key={session.id} className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            
            {/* Header de Sesión */}
            <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <div>
                  <div className="flex items-center gap-3 mb-1">
                     <span className="text-2xl font-black text-slate-800 tracking-tight">
                        {session.time?.slice(0,5)}
                     </span>
                     <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        session.type === 'CrossFit' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                     }`}>
                        {session.type || 'Clase'}
                     </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wide">
                     <Icon name="MapPin" size={12} /> {session.location || 'Sala Principal'}
                  </div>
               </div>
               
               {/* Capacity Badge */}
               <div className="text-right">
                  <span className="block text-xs font-bold text-slate-500">
                     {attendees.length} / {session.capacity || 20}
                  </span>
                  <div className="w-24 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                     <div 
                       className="h-full bg-slate-800 rounded-full" 
                       style={{ width: `${Math.min(100, (attendees.length / (session.capacity || 20)) * 100)}%` }}
                     ></div>
                  </div>
               </div>
            </div>

            {/* Lista de Atletas */}
            <div className="p-2">
               {attendees.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-sm">
                     Esperando inscripciones...
                  </div>
               ) : (
                  <div className="divide-y divide-slate-50">
                     {attendees.map(athlete => (
                        <div key={athlete.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                           
                           {/* Info Atleta */}
                           <div className="flex items-center gap-3">
                              {athlete.avatar ? (
                                <img src={athlete.avatar} alt={athlete.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-sm">
                                   {athlete.name.charAt(0)}
                                </div>
                              )}
                              <span className="font-bold text-slate-700 text-sm">{athlete.name}</span>
                           </div>

                           {/* Botonera de Asistencia (Compacta) */}
                           <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                              <button
                                onClick={() => handleStatusChange(session.id, athlete.id, 'present')}
                                title="Presente"
                                className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                                   athlete.status === 'present' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white'
                                }`}
                              >
                                 <Icon name="Check" size={16} />
                              </button>
                              
                              <button
                                onClick={() => handleStatusChange(session.id, athlete.id, 'late')}
                                title="Tarde"
                                className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                                   athlete.status === 'late' ? 'bg-amber-400 text-white shadow-sm' : 'text-slate-400 hover:bg-white'
                                }`}
                              >
                                 <Icon name="Clock" size={16} />
                              </button>

                              <button
                                onClick={() => handleStatusChange(session.id, athlete.id, 'absent')}
                                title="Ausente"
                                className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                                   athlete.status === 'absent' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white'
                                }`}
                              >
                                 <Icon name="X" size={16} />
                              </button>
                           </div>

                        </div>
                     ))}
                  </div>
               )}
            </div>

          </div>
        );
      })}
    </div>
  );
};

export default AttendanceTracker;