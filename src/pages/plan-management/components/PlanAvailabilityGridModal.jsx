import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchPlanGridAvailability } from '../../../services/plans';

const DAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

const getCapacityColorClasses = (occupied, capacity) => {
  const total = Math.max(0, Number(capacity || 0));
  const used = Math.max(0, Number(occupied || 0));
  const rate = total > 0 ? Math.round((used / total) * 100) : 0;

  if (rate >= 100) {
    return {
      card: 'bg-rose-50 border-rose-200',
      value: 'text-rose-600',
      badge: 'bg-rose-100 text-rose-700',
    };
  }

  if (rate >= 80) {
    return {
      card: 'bg-amber-50 border-amber-200',
      value: 'text-amber-700',
      badge: 'bg-amber-100 text-amber-800',
    };
  }

  return {
    card: 'bg-emerald-50 border-emerald-200',
      value: 'text-emerald-700',
      badge: 'bg-emerald-100 text-emerald-800',
    };
};

const normalizeSchedule = (schedule = []) => {
  return (schedule || [])
    .map((slot) => {
      const capacity = Math.max(0, Number(slot.capacity || 0));
      const remaining = Math.max(
        0,
        Number(slot.remaining_total ?? capacity)
      );
      const occupied = Math.max(
        0,
        Number(slot.plan_assignments_count ?? 0)
      );

      return {
        ...slot,
        day_of_week: Number(slot.day_of_week),
        start_time: String(slot.start_time || '').slice(0, 5),
        end_time: String(slot.end_time || '').slice(0, 5),
        capacity,
        remaining,
        occupied,
      };
    })
    .filter(
      (slot) =>
        Number.isInteger(slot.day_of_week) &&
        slot.day_of_week >= 0 &&
        slot.day_of_week <= 6
    )
    .sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      return String(a.start_time).localeCompare(String(b.start_time));
    });
};

const hourFromTime = (value = '') => {
  const [hh = '0'] = String(value).slice(0, 5).split(':');
  return Number(hh);
};

const getPeriodKey = (time = '') => {
  const hour = hourFromTime(time);

  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
};

const PERIOD_LABELS = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  evening: 'Noche',
};

const groupSlotsByPeriod = (slots = []) => {
  const grouped = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  (slots || []).forEach((slot) => {
    const key = getPeriodKey(slot.start_time);
    grouped[key].push(slot);
  });

  return grouped;
};

const PlanAvailabilityGridModal = ({ plan, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadGrid = async () => {
      if (!plan?.id) {
        if (isMounted) {
          setSlots([]);
          setLoading(false);
        }
        return;
      }

      try {
        if (isMounted) setLoading(true);
        const data = await fetchPlanGridAvailability(plan.id);

        if (isMounted) {
          setSlots(data ?? []);
        }
      } catch (error) {
        console.error('Error cargando grilla de disponibilidad del plan:', error);
        if (isMounted) {
          setSlots([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadGrid();

    return () => {
      isMounted = false;
    };
  }, [plan?.id]);

  const normalizedSchedule = useMemo(
    () => normalizeSchedule(slots),
    [slots]
  );

  const columnsByDay = useMemo(() => {
    return DAYS.map((day, dayIndex) => {
      const daySlots = normalizedSchedule.filter(
        (slot) => Number(slot.day_of_week) === dayIndex
      );

      return {
        day,
        dayIndex,
        slots: daySlots,
        grouped: groupSlotsByPeriod(daySlots),
      };
    }).filter((group) => group.slots.length > 0);
  }, [normalizedSchedule]);

  const maxCapacity = useMemo(() => {
    return Math.max(
      0,
      ...normalizedSchedule.map((slot) => Number(slot.capacity || 0))
    );
  }, [normalizedSchedule]);

  const sessionDuration = Number(plan?.sessionDurationMin || 60);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-7xl max-h-[88vh] bg-white rounded-[1.75rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 to-slate-900 px-5 sm:px-7 py-5 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-white/90 text-[11px] sm:text-xs font-black uppercase tracking-widest">
                {plan?.status === 'active' ? 'Plan activo' : 'Plan inactivo'}
              </span>
              <h2 className="text-xl sm:text-3xl font-black text-white uppercase tracking-wide break-words">
                {plan?.name || 'Plan'}
              </h2>
            </div>

            <p className="text-slate-300 text-xs sm:text-sm mt-2">
              Slots de {sessionDuration} minutos | Cupo máximo: {maxCapacity || 0} personas por turno
            </p>
            <p className="text-slate-400 text-[11px] sm:text-xs mt-1 font-medium">
              Inscriptos del plan / cupo total del slot
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors flex items-center justify-center border border-slate-700 shrink-0"
            aria-label="Cerrar"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Leyenda */}
        <div className="px-5 sm:px-7 py-3 border-b border-slate-200 bg-white shrink-0">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-[11px] sm:text-xs font-black uppercase tracking-wide text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              Alta disponibilidad (0-10)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              Pocos lugares (11-18)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              Sin cupo (19-20)
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
          {loading ? (
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200 shadow-sm">
                <Icon name="LoaderCircle" size={28} className="text-slate-300 animate-spin" />
              </div>
              <h3 className="text-lg font-black text-slate-700 mb-2">
                Cargando grilla
              </h3>
              <p className="text-sm text-slate-500">
                Estamos trayendo la disponibilidad real del plan.
              </p>
            </div>
          ) : columnsByDay.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200 shadow-sm">
                <Icon name="CalendarDays" size={28} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-700 mb-2">
                Sin grilla disponible
              </h3>
              <p className="text-sm text-slate-500">
                Este plan todavía no tiene slots generados para mostrar.
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              {/* Desktop / tablet */}
              <div className="hidden lg:block overflow-x-auto">
                <div className="min-w-[980px] grid grid-flow-col auto-cols-[220px] gap-4">
                  {columnsByDay.map((group) => (
                    <div key={group.dayIndex} className="flex flex-col">
                      <div className="h-11 rounded-xl bg-slate-800 text-white flex items-center justify-center px-3 shadow-sm">
                        <span className="text-sm font-black uppercase tracking-wider">
                          {group.day}
                        </span>
                      </div>

                      <div className="mt-3 space-y-4">
                        {Object.entries(group.grouped).map(([periodKey, periodSlots]) => {
                          if (!periodSlots || periodSlots.length === 0) return null;

                          return (
                            <div key={`${group.dayIndex}-${periodKey}`}>
                              <div className="px-1 pb-2 border-b border-slate-200 mb-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 text-center">
                                  {PERIOD_LABELS[periodKey]}
                                </p>
                              </div>

                              <div className="space-y-3">
                                {periodSlots.map((slot, idx) => {
                                  const color = getCapacityColorClasses(
                                    slot.occupied,
                                    slot.capacity
                                  );

                                  return (
                                    <div
                                      key={`${group.dayIndex}-${periodKey}-${slot.start_time}-${slot.end_time}-${idx}`}
                                      className={`rounded-xl border p-3 ${color.card}`}
                                    >
                                      <p className="text-[15px] font-black text-slate-900">
                                        {slot.start_time} - {slot.end_time}
                                      </p>

                                      <div className="mt-3 flex items-end justify-between gap-2">
                                        <div>
                                          <p className={`text-xl font-black leading-none ${color.value}`}>
                                            {slot.occupied} / {slot.capacity}
                                          </p>
                                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">
                                            Inscriptos del plan / cupo
                                          </p>
                                        </div>

                                        <span
                                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap ${color.badge}`}
                                        >
                                          {slot.remaining > 0
                                            ? `${slot.remaining} libres`
                                            : 'COMPLETO'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile + tablet stacked */}
              <div className="lg:hidden space-y-5">
                {columnsByDay.map((group) => (
                  <div
                    key={`mobile-${group.dayIndex}`}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-slate-800 text-white">
                      <span className="text-sm font-black uppercase tracking-wider">
                        {group.day}
                      </span>
                    </div>

                    <div className="p-4 space-y-4">
                      {Object.entries(group.grouped).map(([periodKey, periodSlots]) => {
                        if (!periodSlots || periodSlots.length === 0) return null;

                        return (
                          <div key={`mobile-${group.dayIndex}-${periodKey}`}>
                            <div className="pb-2 border-b border-slate-100 mb-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                {PERIOD_LABELS[periodKey]}
                              </p>
                            </div>

                            <div className="space-y-3">
                              {periodSlots.map((slot, idx) => {
                                const color = getCapacityColorClasses(
                                  slot.occupied,
                                  slot.capacity
                                );

                                return (
                                  <div
                                    key={`mobile-slot-${group.dayIndex}-${periodKey}-${idx}`}
                                    className={`rounded-xl border p-3 ${color.card}`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-[15px] font-black text-slate-900">
                                          {slot.start_time} - {slot.end_time}
                                        </p>
                                        <p className={`text-lg font-black mt-2 ${color.value}`}>
                                          {slot.occupied} / {slot.capacity}
                                        </p>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">
                                          Inscriptos del plan / cupo
                                        </p>
                                      </div>

                                      <span
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap ${color.badge}`}
                                      >
                                        {slot.remaining > 0
                                          ? `${slot.remaining} libres`
                                          : 'COMPLETO'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-7 py-4 border-t border-slate-200 bg-white flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-black text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanAvailabilityGridModal;