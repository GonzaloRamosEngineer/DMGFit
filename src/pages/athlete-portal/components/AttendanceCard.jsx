import React from 'react';
import Icon from '../../../components/AppIcon';

const AttendanceCard = ({ attendance, attendanceRate }) => {
  const presentCount = attendance?.filter(a => a?.status === 'present')?.length || 0;
  const absentCount = attendance?.filter(a => a?.status === 'absent')?.length || 0;
  const lateCount = attendance?.filter(a => a?.status === 'late')?.length || 0;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-heading font-semibold text-foreground">Mi Asistencia</h2>
        <Icon name="CheckCircle" size={24} color="var(--color-success)" />
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Tasa de Asistencia</span>
          <span className="text-2xl font-bold text-primary">{attendanceRate}%</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-smooth"
            style={{ width: `${attendanceRate}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-success/10 rounded-lg text-center">
          <p className="text-2xl font-bold text-success mb-1">{presentCount}</p>
          <p className="text-xs text-muted-foreground">Presente</p>
        </div>
        <div className="p-3 bg-error/10 rounded-lg text-center">
          <p className="text-2xl font-bold text-error mb-1">{absentCount}</p>
          <p className="text-xs text-muted-foreground">Ausente</p>
        </div>
        <div className="p-3 bg-warning/10 rounded-lg text-center">
          <p className="text-2xl font-bold text-warning mb-1">{lateCount}</p>
          <p className="text-xs text-muted-foreground">Tarde</p>
        </div>
      </div>

      {attendance && attendance?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm font-medium text-muted-foreground mb-2">Últimas Sesiones:</p>
          <div className="space-y-2">
            {attendance?.slice(0, 3)?.map((record) => (
              <div key={record?.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{record?.date}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  record?.status === 'present' ?'bg-success/10 text-success'
                    : record?.status === 'absent' ?'bg-error/10 text-error' :'bg-warning/10 text-warning'
                }`}>
                  {record?.status === 'present' ? 'Presente' : record?.status === 'absent' ? 'Ausente' : 'Tarde'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCard;