import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';

const DAY_LABELS = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

const normalizeTime = (t) => String(t || '').slice(0, 5);

const humanizeDbError = (err) => {
  const msg = String(err?.message || '');
  // Caso típico: constraint pssc_unique_coach_same_timeslot
  if (msg.includes('pssc_unique_coach_same_timeslot') || msg.includes('duplicate key value')) {
    return 'Ese profesor ya está asignado a otro plan en ese mismo horario. Elegí otro profesor o liberá el horario.';
  }
  return msg || 'No se pudo guardar. Revisá los datos e intentá de nuevo.';
};

const ClassSlotModal = ({ slot, onClose, onSuccess, isStaff, classTypes = [], coaches = [] }) => {
  const readOnly = !isStaff;

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [activityId, setActivityId] = useState(slot.activityId || '');
  const [activityDetail, setActivityDetail] = useState(slot.activityDetail || '');

  const initialCoachIds = useMemo(() => (slot.coaches || []).map((c) => c.id), [slot.coaches]);
  const [selectedCoachIds, setSelectedCoachIds] = useState(initialCoachIds);

  const [coachSearch, setCoachSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [infoNote, setInfoNote] = useState('');

  useEffect(() => {
    // Si te abren el modal con data ya cargada, no hace falta “meta fetch”
    setLoading(false);
  }, []);

  const dayLabel = DAY_LABELS[Number(slot.dayOfWeek)] || 'Día';
  const timeLabel = `${normalizeTime(slot.startTime)}–${normalizeTime(slot.endTime)}`;

  const filteredCoaches = useMemo(() => {
    const term = coachSearch.trim().toLowerCase();
    if (!term) return coaches;
    return coaches.filter((c) => String(c.name || '').toLowerCase().includes(term));
  }, [coaches, coachSearch]);

  const toggleCoach = (coachId) => {
    setFormError('');
    setSelectedCoachIds((prev) => {
      const exists = prev.includes(coachId);
      return exists ? prev.filter((x) => x !== coachId) : [...prev, coachId];
    });
  };

  const saveChanges = async () => {
    if (readOnly) return;
    setSaving(true);
    setFormError('');
    setInfoNote('');

    try {
      // 1) Update actividad + detalle en el plan-slot (misma row)
      const { error: updErr } = await supabase
        .from('plan_schedule_slots')
        .update({
          class_type_id: activityId ? activityId : null,
          activity_detail: activityDetail ? activityDetail.trim() : null,
        })
        .eq('id', slot.planScheduleSlotId);

      if (updErr) throw updErr;

      // 2) Diff de coaches
      const before = new Set(initialCoachIds.map(String));
      const after = new Set((selectedCoachIds || []).map(String));

      const toAdd = [...after].filter((x) => !before.has(x));
      const toRemove = [...before].filter((x) => !after.has(x));

      // Removals primero (evita bloqueos innecesarios)
      for (const coachId of toRemove) {
        const { error } = await supabase.rpc('unassign_coach_from_plan_slot', {
          p_plan_id: slot.planId,
          p_weekly_schedule_id: slot.weeklyScheduleId,
          p_coach_id: coachId,
        });
        if (error) throw error;
      }

      // Adds (si choca, DB impone regla y devolvemos mensaje “humano”)
      for (const coachId of toAdd) {
        const { error } = await supabase.rpc('assign_coach_to_plan_slot', {
          p_plan_id: slot.planId,
          p_weekly_schedule_id: slot.weeklyScheduleId,
          p_coach_id: coachId,
        });
        if (error) throw error;
      }

      await onSuccess?.();
    } catch (err) {
      console.error('Error guardando slot:', err);
      setFormError(humanizeDbError(err));
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selectedCoachIds.length;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-[2rem] md:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] md:max-h-[90vh]">
        {/* Mobile grabber */}
        <div className="md:hidden w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="px-5 md:px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 border border-slate-200 px-2 py-1 rounded-full">
                {slot.planName || 'Plan'}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-full">
                {dayLabel}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 border border-slate-200 px-2 py-1 rounded-full">
                {timeLabel}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 border border-slate-200 px-2 py-1 rounded-full">
                Cupo {slot.capacity ?? '-'}
              </span>
            </div>

            <h3 className="mt-3 text-xl font-black text-slate-900 tracking-tight truncate">
              Configuración del horario
            </h3>

            <p className="mt-1 text-xs text-slate-500 font-medium">
              Regla: un profesor no puede estar asignado a dos planes en el mismo horario.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Cerrar"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 space-y-5">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-12 bg-slate-100 rounded-2xl" />
              <div className="h-24 bg-slate-100 rounded-2xl" />
              <div className="h-40 bg-slate-100 rounded-2xl" />
            </div>
          ) : (
            <>
              {formError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-medium">
                  {formError}
                </div>
              )}

              {infoNote && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 font-medium">
                  {infoNote}
                </div>
              )}

              {/* Actividad */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Actividad (opcional)
                  </p>
                  {readOnly && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-full">
                      Solo lectura
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="relative">
                    <select
                      value={activityId}
                      onChange={(e) => setActivityId(e.target.value)}
                      disabled={readOnly}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-60"
                    >
                      <option value="">Sin actividad</option>
                      {classTypes.map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.name}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="ChevronDown"
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>

                  <div className="mt-3">
                    <textarea
                      value={activityDetail}
                      onChange={(e) => setActivityDetail(e.target.value)}
                      disabled={readOnly}
                      rows={3}
                      placeholder="Detalle opcional (ej: Técnica + movilidad / WOD específico / Trabajo de fuerza...)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-60"
                    />
                    <p className="mt-2 text-[11px] text-slate-500">
                      Podés dejarlo vacío. El objetivo es que el profe tenga contexto operativo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Profes */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Profesores asignados
                    </p>
                    <p className="text-sm font-black text-slate-900 mt-1">
                      {selectedCount} seleccionado{selectedCount === 1 ? '' : 's'}
                    </p>
                  </div>

                  {!readOnly && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-full">
                      Multi-selección
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="relative">
                    <Icon
                      name="Search"
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={coachSearch}
                      onChange={(e) => setCoachSearch(e.target.value)}
                      placeholder="Buscar profesor..."
                      className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all"
                    />
                  </div>

                  <div className="mt-3 max-h-64 overflow-y-auto custom-scrollbar space-y-2">
                    {filteredCoaches.map((c) => {
                      const selected = selectedCoachIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => !readOnly && toggleCoach(c.id)}
                          disabled={readOnly}
                          className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                            selected
                              ? 'bg-blue-50 border-blue-200'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          } ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-full overflow-hidden border flex items-center justify-center ${
                              selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-500'
                            }`}>
                              {c.avatar ? (
                                <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                              ) : (
                                (c.name || 'P').charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900 truncate">{c.name}</p>
                              <p className="text-[11px] text-slate-500 truncate">Disponible según regla de horario</p>
                            </div>
                          </div>

                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                            selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}>
                            {selected ? <Icon name="Check" size={16} /> : <Icon name="Plus" size={16} />}
                          </div>
                        </button>
                      );
                    })}

                    {filteredCoaches.length === 0 && (
                      <div className="py-8 text-center text-slate-500">
                        <Icon name="SearchX" size={22} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-black text-slate-700">Sin resultados</p>
                        <p className="text-xs text-slate-500 mt-1">Probá con otro nombre.</p>
                      </div>
                    )}
                  </div>

                  <p className="mt-3 text-[11px] text-slate-500">
                    Podés dejar el horario sin profesor y asignarlo después.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 md:px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-black text-xs text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors uppercase tracking-widest"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={saveChanges}
            disabled={readOnly || saving}
            className={`px-5 py-2.5 rounded-xl font-black text-xs text-white uppercase tracking-widest transition-all flex items-center gap-2 ${
              readOnly
                ? 'bg-slate-300 cursor-not-allowed'
                : saving
                  ? 'bg-blue-400 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-[1px] shadow-md shadow-blue-200'
            }`}
          >
            {saving ? <Icon name="Loader" size={16} className="animate-spin" /> : <Icon name="Save" size={16} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassSlotModal;