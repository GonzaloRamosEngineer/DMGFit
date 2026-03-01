import React, { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchPlanGridAvailability } from '../../../services/plans';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const PlanAvailabilityGridModal = ({ plan, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    const loadGrid = async () => {
      if (!plan?.id) {
        setSlots([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await fetchPlanGridAvailability(plan.id);
        setSlots(data ?? []);
      } catch (error) {
        console.error('Error cargando grilla de disponibilidad del plan:', error);
        setSlots([]);
      } finally {
        setLoading(false);
      }
    };

    loadGrid();
  }, [plan?.id]);

  const groupedByDay = slots.reduce((acc, slot) => {
    const day = Number(slot.day_of_week);
    const key = Number.isInteger(day) ? day : -1;
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-900">Grilla de disponibilidad</h3>
            <p className="text-sm text-slate-500 font-medium">{plan?.name} · Inscriptos del plan / cupo total del slot</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-slate-500 font-medium">Cargando disponibilidad...</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-slate-500 font-medium">Este plan no tiene slots configurados.</p>
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedByDay)
                .map(Number)
                .sort((a, b) => a - b)
                .map((day) => (
                  <section key={day}>
                    <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 mb-3">
                      {DAY_NAMES[day] || 'Día'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupedByDay[day]
                        .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
                        .map((slot) => (
                          <article key={slot.weekly_schedule_id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40">
                            <p className="text-sm font-black text-slate-800">
                              {String(slot.start_time).slice(0, 5)} - {String(slot.end_time).slice(0, 5)}
                            </p>
                            <p className="text-2xl font-black text-slate-900 mt-2">
                              {Number(slot.plan_assignments_count ?? 0)} / {Number(slot.capacity ?? 0)}
                            </p>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Inscriptos del plan / cupo</p>
                            <p className="text-sm font-bold text-slate-700 mt-2">
                              {Math.max(Number(slot.remaining_total ?? 0), 0)} libres
                            </p>
                          </article>
                        ))}
                    </div>
                  </section>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanAvailabilityGridModal;
