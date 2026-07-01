import React, { useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const normalizeRelation = (value) => {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
};

const groupByDay = (slots) => {
  return (slots || []).reduce((acc, slot) => {
    const day = Number(slot.day_of_week);
    const key = Number.isInteger(day) ? day : 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});
};

const getAssignedWeeklyScheduleId = (slot) =>
  slot?.weekly_schedule_id || normalizeRelation(slot?.weekly_schedule)?.id || null;

const ModifyAthleteScheduleModal = ({
  athlete,
  assignedSlots,
  availableSlots,
  loading = false,
  onClose,
  onSave,
}) => {
  const visits = Number(athlete?.visits_per_week || 0);

  const [selectedSlotIds, setSelectedSlotIds] = useState(
    (assignedSlots || [])
      .map((slot) => getAssignedWeeklyScheduleId(slot))
      .filter(Boolean)
  );

  const assignedSet = useMemo(
    () =>
      new Set(
        (assignedSlots || [])
          .map((slot) => getAssignedWeeklyScheduleId(slot))
          .filter(Boolean)
      ),
    [assignedSlots]
  );

  const availableGrouped = useMemo(() => groupByDay(availableSlots), [availableSlots]);

  const toggleSlot = (slotId, disabled) => {
    if (disabled) return;

    setSelectedSlotIds((prev) => {
      const exists = prev.includes(slotId);
      if (exists) return prev.filter((id) => id !== slotId);
      if (prev.length >= visits) return prev;
      return [...prev, slotId];
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (selectedSlotIds.length !== visits) return;
    await onSave(selectedSlotIds);
  };

  return (
    <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-text-primary">Modificar horarios del atleta</h3>
            <p className="text-xs text-text-secondary mt-1">
              {athlete?.name} · {athlete?.planName || 'Sin Plan'} · Frecuencia: {visits} por semana
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-muted text-text-secondary flex items-center justify-center">
            <Icon name="X" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          <div className="bg-muted border border-border rounded-xl p-3">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              Seleccionados: {selectedSlotIds.length} / {visits}
            </p>
            <p className="text-[11px] text-text-secondary mt-1">
              El cambio se aplica desde hoy y conserva plan/opción/precio/frecuencia.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-black text-text-secondary mb-2">Horarios actuales</h4>
            <div className="flex flex-wrap gap-2">
              {(assignedSlots || []).length === 0 ? (
                <p className="text-xs text-text-tertiary">Sin asignaciones activas.</p>
              ) : (
                assignedSlots.map((slot) => {
                  const schedule = normalizeRelation(slot.weekly_schedule) || slot;
                  const day = Number(schedule?.day_of_week);
                  const start = String(schedule?.start_time || '').slice(0, 5);
                  const end = String(schedule?.end_time || '').slice(0, 5);

                  return (
                    <span
                      key={slot.id || schedule?.id}
                      className="px-2 py-1 rounded-lg bg-info-light border border-info/20 text-info text-xs font-bold"
                    >
                      {DAYS[day] || 'Horario'} {start}-{end}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-black text-text-secondary">Disponibilidad del plan</h4>
            {Object.keys(availableGrouped).length === 0 ? (
              <p className="text-xs text-text-tertiary">Este plan no tiene slots configurados.</p>
            ) : (
              Object.entries(availableGrouped)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([day, slots]) => (
                  <div key={day} className="border border-border rounded-xl p-3">
                    <p className="text-xs font-black text-text-secondary uppercase tracking-wider mb-2">
                      {DAYS[day]}
                    </p>
                    <div className="space-y-2">
                      {slots.map((slot) => {
                        const slotId = slot.weekly_schedule_id;
                        const selected = selectedSlotIds.includes(slotId);
                        const owned = assignedSet.has(slotId);
                        const fullForNew = Number(slot.remaining) <= 0 && !owned;
                        const disabled = loading || fullForNew || (!selected && selectedSlotIds.length >= visits);

                        return (
                          <label
                            key={slotId}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${
                              disabled
                                ? 'bg-muted text-text-tertiary border-border'
                                : 'bg-card text-text-secondary border-border cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selected}
                                disabled={disabled}
                                onChange={() => toggleSlot(slotId, disabled)}
                              />
                              <span className="font-semibold">
                                {String(slot.start_time).slice(0, 5)}-{String(slot.end_time).slice(0, 5)}
                              </span>
                              {owned && (
                                <span className="px-1.5 py-0.5 rounded bg-info-light text-info text-[10px] font-black">
                                  Actual
                                </span>
                              )}
                            </div>
                            <span className={`font-black ${Number(slot.remaining) <= 1 ? 'text-error' : 'text-success'}`}>
                              {slot.remaining}/{slot.capacity}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))
            )}
          </div>
        </form>

        <div className="px-6 py-4 border-t border-border bg-muted flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-text-secondary hover:bg-muted rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || selectedSlotIds.length !== visits || visits <= 0}
            className={`px-4 py-2 text-sm font-bold rounded-lg text-primary-foreground ${
              loading || selectedSlotIds.length !== visits || visits <= 0
                ? 'bg-muted-foreground cursor-not-allowed'
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {loading ? 'Guardando...' : 'Guardar horarios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModifyAthleteScheduleModal;