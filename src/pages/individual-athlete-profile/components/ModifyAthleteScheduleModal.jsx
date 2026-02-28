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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-100 rounded-[2rem] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-800">Modificar horarios del atleta</h3>
            <p className="text-xs text-slate-500 mt-1">
              {athlete?.name} · {athlete?.planName || 'Sin Plan'} · Frecuencia: {visits} por semana
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-500 flex items-center justify-center">
            <Icon name="X" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Seleccionados: {selectedSlotIds.length} / {visits}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              El cambio se aplica desde hoy y conserva plan/opción/precio/frecuencia.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-black text-slate-700 mb-2">Horarios actuales</h4>
            <div className="flex flex-wrap gap-2">
              {(assignedSlots || []).length === 0 ? (
                <p className="text-xs text-slate-400">Sin asignaciones activas.</p>
              ) : (
                assignedSlots.map((slot) => {
                  const schedule = normalizeRelation(slot.weekly_schedule) || slot;
                  const day = Number(schedule?.day_of_week);
                  const start = String(schedule?.start_time || '').slice(0, 5);
                  const end = String(schedule?.end_time || '').slice(0, 5);

                  return (
                    <span
                      key={slot.id || schedule?.id}
                      className="px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold"
                    >
                      {DAYS[day] || 'Horario'} {start}-{end}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-black text-slate-700">Disponibilidad del plan</h4>
            {Object.keys(availableGrouped).length === 0 ? (
              <p className="text-xs text-slate-400">Este plan no tiene slots configurados.</p>
            ) : (
              Object.entries(availableGrouped)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([day, slots]) => (
                  <div key={day} className="border border-slate-200 rounded-xl p-3">
                    <p className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
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
                                ? 'bg-slate-100 text-slate-400 border-slate-200'
                                : 'bg-white text-slate-700 border-slate-200 cursor-pointer'
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
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-black">
                                  Actual
                                </span>
                              )}
                            </div>
                            <span className={`font-black ${Number(slot.remaining) <= 1 ? 'text-rose-500' : 'text-emerald-600'}`}>
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

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || selectedSlotIds.length !== visits || visits <= 0}
            className={`px-4 py-2 text-sm font-bold rounded-lg text-white ${
              loading || selectedSlotIds.length !== visits || visits <= 0
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
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