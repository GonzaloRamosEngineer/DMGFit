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
    setLoading(false);
  }, []);

  const dayLabel = DAY_LABELS[Number(slot.dayOfWeek)] || 'Día';
  const timeLabel = `${normalizeTime(slot.startTime)} – ${normalizeTime(slot.endTime)}`;

  // Derive activity color for accent
  const selectedActivity = classTypes.find((ct) => String(ct.id) === String(activityId));
  const accentColor = selectedActivity?.color || slot.activityColor || '#3b82f6';

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
      const { error: updErr } = await supabase
        .from('plan_schedule_slots')
        .update({
          class_type_id: activityId ? activityId : null,
          activity_detail: activityDetail ? activityDetail.trim() : null,
        })
        .eq('id', slot.planScheduleSlotId);

      if (updErr) throw updErr;

      const before = new Set(initialCoachIds.map(String));
      const after = new Set((selectedCoachIds || []).map(String));

      const toAdd = [...after].filter((x) => !before.has(x));
      const toRemove = [...before].filter((x) => !after.has(x));

      for (const coachId of toRemove) {
        const { error } = await supabase.rpc('unassign_coach_from_plan_slot', {
          p_plan_id: slot.planId,
          p_weekly_schedule_id: slot.weeklyScheduleId,
          p_coach_id: coachId,
        });
        if (error) throw error;
      }

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
    <div className="fixed inset-0 z-modal bg-foreground/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] md:max-h-[90vh]">
        {/* Mobile grabber */}
        <div className="md:hidden w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Colored accent bar */}
        <div className="h-1 shrink-0" style={{ backgroundColor: accentColor }} />

        {/* Header */}
        <div className="px-5 md:px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* Breadcrumb-style meta */}
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest bg-muted text-text-secondary px-2 py-1 rounded-lg">
                  {slot.planName || 'Plan'}
                </span>
                <Icon name="ChevronRight" size={12} className="text-text-tertiary" />
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg text-primary bg-info-light">
                  {dayLabel}
                </span>
                <Icon name="ChevronRight" size={12} className="text-text-tertiary" />
                <span className="text-[10px] font-black uppercase tracking-widest bg-muted text-text-secondary px-2 py-1 rounded-lg">
                  {timeLabel}
                </span>
              </div>

              <h3 className="text-xl font-black text-text-primary tracking-tight leading-none">
                Configuración del horario
              </h3>

              {/* Capacity + rule note */}
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-text-secondary">
                  <Icon name="Users" size={12} />
                  Cupo {slot.capacity ?? '–'}
                </span>
                <span className="text-border">·</span>
                <span className="text-[10px] font-medium text-text-tertiary">
                  Un profe no puede estar en dos planes a la vez
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-muted transition-colors shrink-0 mt-0.5"
            >
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 space-y-4 bg-muted/40">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-12 bg-muted rounded-2xl" />
              <div className="h-24 bg-muted rounded-2xl" />
              <div className="h-40 bg-muted rounded-2xl" />
            </div>
          ) : (
            <>
              {formError && (
                <div className="rounded-xl border border-border bg-error-light px-4 py-3 flex items-start gap-3">
                  <Icon name="AlertCircle" size={16} className="text-error shrink-0 mt-0.5" />
                  <p className="text-sm text-error font-medium">{formError}</p>
                </div>
              )}

              {infoNote && (
                <div className="rounded-xl border border-border bg-info-light px-4 py-3 flex items-start gap-3">
                  <Icon name="Info" size={16} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-primary font-medium">{infoNote}</p>
                </div>
              )}

              {/* Actividad */}
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-info-light flex items-center justify-center">
                      <Icon name="Activity" size={13} className="text-primary" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-text-secondary">
                      Actividad
                    </p>
                    <span className="text-[10px] text-text-tertiary font-medium">(opcional)</span>
                  </div>
                  {readOnly && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-text-tertiary bg-muted border border-border px-2 py-0.5 rounded-full">
                      Solo lectura
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  <div className="relative">
                    <select
                      value={activityId}
                      onChange={(e) => setActivityId(e.target.value)}
                      disabled={readOnly}
                      className="w-full appearance-none bg-muted border border-border rounded-xl px-3 py-3 text-sm font-bold text-text-primary outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all disabled:opacity-60 pr-10"
                    >
                      <option value="">Sin actividad asignada</option>
                      {classTypes.map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.name}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="ChevronDown"
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
                    />
                  </div>

                  <div>
                    <textarea
                      value={activityDetail}
                      onChange={(e) => setActivityDetail(e.target.value)}
                      disabled={readOnly}
                      rows={3}
                      placeholder="Detalle opcional — ej: Técnica + movilidad / WOD específico / Trabajo de fuerza..."
                      className="w-full bg-muted border border-border rounded-xl px-3 py-3 text-sm text-text-secondary outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all disabled:opacity-60 resize-none leading-relaxed"
                    />
                    <p className="mt-1.5 text-[11px] text-text-tertiary leading-snug">
                      Contexto operativo para el profe. Podés dejarlo vacío.
                    </p>
                  </div>
                </div>
              </div>

              {/* Profes */}
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-info-light flex items-center justify-center">
                      <Icon name="Users" size={13} className="text-primary" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-text-secondary">
                      Profesores
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedCount > 0 && (
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black text-white"
                        style={{ backgroundColor: accentColor }}
                      >
                        {selectedCount}
                      </span>
                    )}
                    {!readOnly && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-text-tertiary bg-muted border border-border px-2 py-0.5 rounded-full">
                        Multi-selección
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="relative">
                    <Icon
                      name="Search"
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                    />
                    <input
                      value={coachSearch}
                      onChange={(e) => setCoachSearch(e.target.value)}
                      placeholder="Buscar profesor..."
                      className="w-full pl-9 pr-3 py-2.5 bg-muted border border-border rounded-xl text-sm font-medium text-text-secondary outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1.5 -mx-1 px-1">
                    {filteredCoaches.map((c) => {
                      const selected = selectedCoachIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => !readOnly && toggleCoach(c.id)}
                          disabled={readOnly}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                            selected
                              ? 'bg-info-light border-border shadow-sm'
                              : 'bg-card border-border hover:bg-muted hover:border-border'
                          } ${readOnly ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar */}
                            <div
                              className={`w-8 h-8 rounded-full overflow-hidden border-2 flex items-center justify-center text-xs font-black shrink-0 transition-all ${
                                selected
                                  ? 'border-primary ring-2 ring-primary/10'
                                  : 'border-border'
                              }`}
                              style={selected ? { backgroundColor: accentColor + '22', borderColor: accentColor } : { backgroundColor: '#f1f5f9' }}
                            >
                              {c.avatar ? (
                                <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                              ) : (
                                <span style={selected ? { color: accentColor } : { color: '#94a3b8' }}>
                                  {(c.name || 'P').charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className={`text-sm font-bold truncate leading-tight ${selected ? 'text-text-primary' : 'text-text-secondary'}`}>
                                {c.name}
                              </p>
                              <p className="text-[10px] text-text-tertiary truncate">
                                Disponible según regla de horario
                              </p>
                            </div>
                          </div>

                          {/* Checkbox-like indicator */}
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                              selected
                                ? 'border-transparent text-white'
                                : 'border-border bg-card text-transparent'
                            }`}
                            style={selected ? { backgroundColor: accentColor } : {}}
                          >
                            <Icon name="Check" size={12} />
                          </div>
                        </button>
                      );
                    })}

                    {filteredCoaches.length === 0 && (
                      <div className="py-8 text-center">
                        <Icon name="SearchX" size={22} className="mx-auto text-text-tertiary mb-2" />
                        <p className="text-sm font-black text-text-secondary">Sin resultados</p>
                        <p className="text-xs text-text-tertiary mt-1">Probá con otro nombre.</p>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-text-tertiary">
                    Podés dejar el horario sin profesor y asignarlo después.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 md:px-6 py-4 bg-card border-t border-border flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-black text-xs text-text-secondary bg-muted hover:bg-muted/80 transition-colors uppercase tracking-widest"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={saveChanges}
            disabled={readOnly || saving}
            className={`px-5 py-2.5 rounded-xl font-black text-xs text-white uppercase tracking-widest transition-all flex items-center gap-2 ${
              readOnly
                ? 'bg-muted cursor-not-allowed'
                : saving
                  ? 'opacity-70 cursor-wait'
                  : 'hover:-translate-y-0.5 shadow-md active:translate-y-0'
            }`}
            style={!readOnly ? { backgroundColor: accentColor, boxShadow: `0 4px 14px ${accentColor}40` } : {}}
          >
            {saving ? <Icon name="Loader" size={15} className="animate-spin" /> : <Icon name="Save" size={15} />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassSlotModal;