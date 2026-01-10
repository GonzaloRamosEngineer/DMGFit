import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const AttendanceTracker = ({ sessions, selectedDate }) => {
  const [attendanceRecords, setAttendanceRecords] = useState({});

  const todaySessions = sessions?.filter(s => s?.date === selectedDate);

  const handleAttendanceChange = (sessionId, athleteId, status) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [`${sessionId}-${athleteId}`]: status
    }));
  };

  const getAttendanceStatus = (sessionId, athleteId) => {
    return attendanceRecords?.[`${sessionId}-${athleteId}`] || 'pending';
  };

  const handleSaveAttendance = (sessionId) => {
    console.log('Guardando asistencia para sesión:', sessionId);
    alert('Asistencia guardada correctamente');
  };

  return (
    <div className="space-y-6">
      {todaySessions?.length > 0 ? (
        todaySessions?.map((session) => (
          <div key={session?.id} className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-heading font-semibold text-foreground mb-2">{session?.type}</h3>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Icon name="Clock" size={16} />
                    <span>{session?.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="MapPin" size={16} />
                    <span>{session?.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="Users" size={16} />
                    <span>{session?.attendees?.length} atletas</span>
                  </div>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                session?.status === 'completed'
                  ? 'bg-success/10 text-success' :'bg-warning/10 text-warning'
              }`}>
                {session?.status === 'completed' ? 'Completada' : 'Pendiente'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-sm font-medium text-muted-foreground">Atleta</span>
                <div className="flex gap-2">
                  <span className="text-sm font-medium text-muted-foreground w-20 text-center">Presente</span>
                  <span className="text-sm font-medium text-muted-foreground w-20 text-center">Ausente</span>
                  <span className="text-sm font-medium text-muted-foreground w-20 text-center">Tarde</span>
                </div>
              </div>

              {session?.attendees?.map((athleteId) => {
                const status = getAttendanceStatus(session?.id, athleteId);
                return (
                  <div key={athleteId} className="flex items-center justify-between py-2">
                    <span className="text-sm text-foreground">Atleta {athleteId}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAttendanceChange(session?.id, athleteId, 'present')}
                        className={`w-20 h-8 rounded-lg border transition-smooth ${
                          status === 'present' ?'bg-success border-success text-white' :'border-border hover:border-success hover:bg-success/10'
                        }`}
                      >
                        <Icon name="Check" size={16} className="mx-auto" />
                      </button>
                      <button
                        onClick={() => handleAttendanceChange(session?.id, athleteId, 'absent')}
                        className={`w-20 h-8 rounded-lg border transition-smooth ${
                          status === 'absent' ?'bg-error border-error text-white' :'border-border hover:border-error hover:bg-error/10'
                        }`}
                      >
                        <Icon name="X" size={16} className="mx-auto" />
                      </button>
                      <button
                        onClick={() => handleAttendanceChange(session?.id, athleteId, 'late')}
                        className={`w-20 h-8 rounded-lg border transition-smooth ${
                          status === 'late' ?'bg-warning border-warning text-black' :'border-border hover:border-warning hover:bg-warning/10'
                        }`}
                      >
                        <Icon name="Clock" size={16} className="mx-auto" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-border flex justify-end">
              <Button
                variant="default"
                size="md"
                iconName="Save"
                onClick={() => handleSaveAttendance(session?.id)}
              >
                Guardar Asistencia
              </Button>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Icon name="Calendar" size={64} color="var(--color-muted-foreground)" className="mx-auto mb-4" />
          <h3 className="text-lg font-heading font-semibold text-foreground mb-2">No hay sesiones para esta fecha</h3>
          <p className="text-muted-foreground">Selecciona otra fecha para ver las sesiones programadas</p>
        </div>
      )}
    </div>
  );
};

export default AttendanceTracker;