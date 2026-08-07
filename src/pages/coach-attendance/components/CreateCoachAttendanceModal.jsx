import React, { useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';

const fmtDuration = (min) => {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

const todayLocal = () => {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().split('T')[0];
};

/**
 * Registrar la asistencia de un profesor DESDE CERO, sin que haya fichado nada en
 * el kiosco. Caso típico: se olvidó el DNI y avisa por WhatsApp los horarios que
 * hizo, y administración lo carga directamente.
 */
const CreateCoachAttendanceModal = ({ coaches = [], onClose, onSave, saving = false }) => {
  const [coachId, setCoachId] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [error, setError] = useState('');

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

    if (!coachId) {
      setError('Elegí un profesor.');
      return;
    }
    if (!date) {
      setError('Elegí una fecha.');
      return;
    }
    if (!checkIn) {
      setError('Poné la hora de entrada.');
      return;
    }
    if (checkOut && minutos !== null && minutos <= 0) {
      setError('La salida tiene que ser posterior a la entrada.');
      return;
    }

    await onSave({ coachId, date, checkIn, checkOut: checkOut || null });
  };

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      size="sm"
      title="Registrar asistencia"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-text-secondary">
          Para cargar una presencia que no se fichó en el kiosco (p.ej. el profe avisó los
          horarios por otro medio).
        </p>

        <div>
          <label
            htmlFor="coach-create-select"
            className="text-[11px] font-bold uppercase tracking-wider text-text-secondary"
          >
            Profesor
          </label>
          <select
            id="coach-create-select"
            value={coachId}
            onChange={(e) => setCoachId(e.target.value)}
            disabled={saving}
            className="mt-1 w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm"
          >
            <option value="">Elegí un profesor</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="coach-create-date"
            className="text-[11px] font-bold uppercase tracking-wider text-text-secondary"
          >
            Fecha
          </label>
          <input
            id="coach-create-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={saving}
            className="mt-1 w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm tabular-nums"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="coach-create-check-in"
              className="text-[11px] font-bold uppercase tracking-wider text-text-secondary"
            >
              Entrada
            </label>
            <input
              id="coach-create-check-in"
              type="time"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              disabled={saving}
              className="mt-1 w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="coach-create-check-out"
              className="text-[11px] font-bold uppercase tracking-wider text-text-secondary"
            >
              Salida (opcional)
            </label>
            <input
              id="coach-create-check-out"
              type="time"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              disabled={saving}
              className="mt-1 w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm tabular-nums"
            />
          </div>
        </div>

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

export default CreateCoachAttendanceModal;
