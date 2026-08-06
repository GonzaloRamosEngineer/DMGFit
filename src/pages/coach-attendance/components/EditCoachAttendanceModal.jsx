import React, { useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const TZ = 'America/Argentina/Buenos_Aires';

// Hora local del gimnasio (HH:MM) a partir de un timestamptz.
const toLocalTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: TZ,
    });
  } catch {
    return '';
  }
};

const fmtDuration = (min) => {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

/**
 * Corrección manual de la entrada/salida de un profesor.
 * Caso típico: se fue y no fichó la salida, así que el día queda "En curso" y sus
 * horas no se computan. Acá se carga la hora real a la que se fue.
 */
const EditCoachAttendanceModal = ({ row, onClose, onSave, saving = false }) => {
  const [checkIn, setCheckIn] = useState(() => toLocalTime(row?.check_in_time));
  const [checkOut, setCheckOut] = useState(() => toLocalTime(row?.check_out_time));
  const [error, setError] = useState('');

  const fecha = useMemo(() => {
    const base = row?.local_checkin_date;
    if (!base) return '';
    const d = new Date(`${base}T00:00:00`);
    return `${DAY_NAMES[d.getDay()]} ${d.toLocaleDateString('es-AR')}`;
  }, [row]);

  // Vista previa de las horas que van a quedar, con la misma cuenta que la tabla.
  const minutos = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    const [hi, mi] = checkIn.split(':').map(Number);
    const [ho, mo] = checkOut.split(':').map(Number);
    if ([hi, mi, ho, mo].some((n) => !Number.isFinite(n))) return null;
    return ho * 60 + mo - (hi * 60 + mi);
  }, [checkIn, checkOut]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!checkIn) {
      setError('Poné la hora de entrada.');
      return;
    }
    if (checkOut && minutos !== null && minutos <= 0) {
      setError('La salida tiene que ser posterior a la entrada.');
      return;
    }

    await onSave({ checkIn, checkOut });
  };

  return (
    <Modal
      open={!!row}
      onClose={saving ? () => {} : onClose}
      size="sm"
      title="Corregir asistencia"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm font-bold text-text-primary">
            {row?.coaches?.profiles?.full_name || 'Profesor'}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">{fecha}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="coach-check-in"
              className="text-[11px] font-bold uppercase tracking-wider text-text-secondary"
            >
              Entrada
            </label>
            <input
              id="coach-check-in"
              type="time"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              disabled={saving}
              className="mt-1 w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="coach-check-out"
              className="text-[11px] font-bold uppercase tracking-wider text-text-secondary"
            >
              Salida
            </label>
            <input
              id="coach-check-out"
              type="time"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              disabled={saving}
              className="mt-1 w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm tabular-nums"
            />
          </div>
        </div>

        {/* El control nativo de hora se dibuja en 12h (AM/PM) según el idioma del
            navegador, mientras que toda la app usa 24h. Se repite el rango en 24h
            para que no quede duda: "las 8" de la noche son 20:00, no 08:00. */}
        {checkOut && minutos !== null && minutos > 0 && (
          <p className="text-[11px] text-text-secondary">
            De <span className="font-bold text-text-primary tabular-nums">{checkIn}</span> a{' '}
            <span className="font-bold text-text-primary tabular-nums">{checkOut}</span>:{' '}
            <span className="font-bold text-text-primary">{fmtDuration(minutos)}</span> trabajados.
          </p>
        )}

        {!checkOut && (
          <p className="text-[11px] text-text-secondary">
            Sin salida el día queda “En curso” y no suma horas.
          </p>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-error">
            <Icon name="AlertCircle" size={13} />
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
};

export default EditCoachAttendanceModal;
