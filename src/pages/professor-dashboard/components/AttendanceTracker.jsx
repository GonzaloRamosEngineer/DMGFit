import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const AttendanceTracker = ({ sessions, selectedDate }) => {
  // Estado local para manejar cambios temporales antes de guardar en DB
  const [attendanceRecords, setAttendanceRecords] = useState({});

  const todaySessions = sessions?.filter(s => s.session_date === selectedDate);

  const handleAttendanceChange = (sessionId, athleteId, status) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [`${sessionId}-${athleteId}`]: status
    }));
  };

  const getAttendanceStatus = (sessionId, athleteId) => {
    // Prioridad: Estado local > Estado guardado en DB > 'pending'
    return attendanceRecords[`${sessionId}-${athleteId}`] || 'pending';
  };

  const handleSaveAttendance = (sessionId) => {
    // Aquí iría la lógica para enviar a Supabase (update o insert en tabla attendance)
    console.log('Guardando asistencia para sesión:', sessionId, attendanceRecords);
    alert('Asistencia guardada correctamente (Simulado)');
  };

  if (!todaySessions || todaySessions.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <Icon name="Calendar" size={64} color="var(--color-muted-foreground)" className="mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">No hay sesiones para esta fecha</h3>
        <p className="text-muted-foreground">Selecciona otra fecha para gestionar la asistencia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {todaySessions.map((session) => (
        <div key={session.id} className="bg-card border border-border rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between mb-6 gap-4">
            <div>
              <h3 className="text-xl font-heading font-semibold text-foreground mb-2">{session.type || 'Entrenamiento'}</h3>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Icon name="Clock" size={16} />
                  <span>{session.time?.slice(0, 5)}</span>
                </div>
                {session.location && (
                  <div className="flex items-center gap-2">
                    <Icon name="MapPin" size={16} />
                    <span>{session.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Icon name="Users" size={16} />
                  <span>{session.attendees?.length || 0} inscritos</span>
                </div>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-lg text-xs font-medium self-start ${
              session.status === 'completed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
            }`}>
              {session.status === 'completed' ? 'Completada' : 'Pendiente'}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="text-sm font-medium text-muted-foreground">Atleta</span>
              <div className="flex gap-2">
                <span className="text-xs font-medium text-muted-foreground w-10 text-center md:w-20">Presente</span>
                <span className="text-xs font-medium text-muted-foreground w-10 text-center md:w-20">Ausente</span>
                <span className="text-xs font-medium text-muted-foreground w-10 text-center md:w-20">Tarde</span>
              </div>
            </div>

            {/* Simulación de lista de atletas inscritos (en producción esto vendría de session.attendees detallado) */}
            {/* Si no hay attendees detallados, mostramos mensaje */}
            {(!session.attendees || session.attendees.length === 0) ? (
               <p className="text-sm text-muted-foreground py-4 text-center">No hay atletas inscritos en esta sesión.</p>
            ) : (
               session.attendees.map((athlete) => {
                // Asumimos que athlete es un objeto { id, name } o similar
                // Si es solo ID, necesitaríamos buscar el nombre
                const athleteId = athlete.id || athlete; 
                const status = getAttendanceStatus(session.id, athleteId);
                
                return (
                  <div key={athleteId} className="flex items-center justify-between py-2">
                    <span className="text-sm text-foreground">{athlete.name || `Atleta ${athleteId}`}</span>
                    <div className="flex gap-2">
                      {['present', 'absent', 'late'].map((type) => (
                        <button
                          key={type}
                          onClick={() => handleAttendanceChange(session.id, athleteId, type)}
                          className={`w-10 md:w-20 h-8 rounded-lg border transition-smooth flex items-center justify-center ${
                            status === type 
                              ? type === 'present' ? 'bg-success border-success text-white' 
                              : type === 'absent' ? 'bg-error border-error text-white' 
                              : 'bg-warning border-warning text-black'
                              : 'border-border hover:bg-muted'
                          }`}
                        >
                          <Icon 
                            name={type === 'present' ? 'Check' : type === 'absent' ? 'X' : 'Clock'} 
                            size={16} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-border flex justify-end">
            <Button
              variant="default"
              size="md"
              iconName="Save"
              onClick={() => handleSaveAttendance(session.id)}
            >
              Guardar Asistencia
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AttendanceTracker;