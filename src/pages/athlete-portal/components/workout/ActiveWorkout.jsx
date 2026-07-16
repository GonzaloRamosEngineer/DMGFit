import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../../components/AppIcon';

const newSet = () => ({ id: crypto.randomUUID(), kg: '', reps: '', min: '', sec: '', km: '', done: false });

export const createEntry = (exercise) => ({
  exercise,
  sets: [newSet()],
});

const FIELDS_BY_TRACKING = {
  reps_weight: ['kg', 'reps'],
  assisted_bodyweight: ['kg', 'reps'],
  bodyweight: ['reps'],
  reps: ['reps'],
  time: ['min', 'sec'],
  distance: ['km'],
  time_distance: ['km', 'min'],
};

const FIELD_LABELS = { kg: 'KG', reps: 'REPS', min: 'MIN', sec: 'SEG', km: 'KM' };

const fieldsFor = (exercise) => FIELDS_BY_TRACKING[exercise?.tracking_type] || FIELDS_BY_TRACKING.reps_weight;

const setHasValue = (set, fields) => fields.some((f) => set[f] !== '' && set[f] != null);

export const setToPayload = (set) => {
  const min = Number(set.min) || 0;
  const sec = Number(set.sec) || 0;
  const timeSec = min || sec ? min * 60 + sec : null;
  return { ...set, timeSec };
};

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}min`;
  if (m) return `${m}min ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
};

const HudStat = ({ label, value, accent = false }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">{label}</p>
    <p className={`truncate text-lg font-black tabular-nums ${accent ? 'text-primary' : 'text-text-primary'}`}>{value}</p>
  </div>
);

const SetInput = ({ value, onChange, placeholder }) => (
  <input
    value={value}
    onChange={(e) => {
      const v = e.target.value.replace(',', '.');
      if (/^\d*\.?\d*$/.test(v)) onChange(v);
    }}
    inputMode="decimal"
    placeholder={placeholder}
    className="h-10 w-full rounded-xl border border-transparent bg-muted text-center text-sm font-black tabular-nums text-text-primary outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-primary focus:bg-card"
  />
);

/**
 * Pantalla de entrenamiento en curso (estilo Hevy): HUD con duración en vivo,
 * volumen y series completadas; un bloque por ejercicio con filas por serie.
 */
const ActiveWorkout = ({
  draft,
  onChange,
  onAddExercisesClick,
  onExerciseInfo,
  onFinish,
  onDiscard,
  saving = false,
}) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const paused = !draft.segmentStart;
  const elapsedSec = Math.max(
    0,
    Math.floor(
      (draft.accumulatedSec || 0) +
        (draft.segmentStart ? (now - new Date(draft.segmentStart).getTime()) / 1000 : 0)
    )
  );

  const togglePause = () => {
    if (paused) {
      onChange({ ...draft, segmentStart: new Date().toISOString() });
    } else {
      const ran = Math.max(0, (Date.now() - new Date(draft.segmentStart).getTime()) / 1000);
      onChange({ ...draft, accumulatedSec: (draft.accumulatedSec || 0) + ran, segmentStart: null });
    }
  };

  const { volume, seriesDone } = useMemo(() => {
    let vol = 0;
    let done = 0;
    draft.entries.forEach((entry) => {
      entry.sets.forEach((set) => {
        if (!set.done) return;
        done += 1;
        const kg = Number(set.kg);
        const reps = Number(set.reps);
        if (Number.isFinite(kg) && Number.isFinite(reps)) vol += kg * reps;
      });
    });
    return { volume: vol, seriesDone: done };
  }, [draft.entries]);

  const patchEntries = (entries) => onChange({ ...draft, entries });

  const updateSet = (entryIdx, setIdx, patch) => {
    const entries = draft.entries.map((entry, i) => {
      if (i !== entryIdx) return entry;
      const sets = entry.sets.map((set, j) => (j === setIdx ? { ...set, ...patch } : set));
      return { ...entry, sets };
    });
    patchEntries(entries);
  };

  const addSet = (entryIdx) => {
    const entries = draft.entries.map((entry, i) => {
      if (i !== entryIdx) return entry;
      const last = entry.sets[entry.sets.length - 1];
      // Precargar la nueva serie con los valores de la anterior (patrón Hevy).
      const seeded = { ...newSet(), kg: last?.kg ?? '', reps: last?.reps ?? '', min: last?.min ?? '', sec: last?.sec ?? '', km: last?.km ?? '' };
      return { ...entry, sets: [...entry.sets, seeded] };
    });
    patchEntries(entries);
  };

  const removeSet = (entryIdx, setIdx) => {
    const entries = draft.entries
      .map((entry, i) => (i === entryIdx ? { ...entry, sets: entry.sets.filter((_, j) => j !== setIdx) } : entry))
      .filter((entry) => entry.sets.length > 0);
    patchEntries(entries);
  };

  const removeEntry = (entryIdx) => {
    patchEntries(draft.entries.filter((_, i) => i !== entryIdx));
  };

  return (
    <div className="space-y-5">
      {/* Barra superior: título + acciones */}
      <div className="flex items-center justify-between gap-2">
        <input
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder="Entrenamiento"
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1 text-xl font-black text-text-primary outline-none transition-colors focus:border-border focus:bg-card"
        />
        <button
          type="button"
          onClick={togglePause}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
            paused
              ? 'border-warning/30 bg-warning-light text-warning'
              : 'border-border bg-card text-text-secondary hover:text-primary'
          }`}
          aria-label={paused ? 'Reanudar entrenamiento' : 'Pausar entrenamiento'}
        >
          <Icon name={paused ? 'Play' : 'Pause'} size={17} />
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={saving}
          className="h-11 shrink-0 rounded-full bg-primary px-6 text-sm font-black text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Terminar'}
        </button>
      </div>

      {/* HUD */}
      <div className="grid grid-cols-3 gap-4 rounded-3xl border border-border bg-card px-5 py-4">
        <HudStat
          label={paused ? 'En pausa' : 'Duración'}
          value={formatDuration(elapsedSec)}
          accent={!paused}
        />
        <HudStat label="Volumen" value={`${volume.toLocaleString('es-AR')} kg`} />
        <HudStat label="Series" value={seriesDone} />
      </div>

      {/* Ejercicios */}
      {draft.entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon name="Dumbbell" size={26} />
          </div>
          <p className="text-base font-black text-text-primary">Empezar</p>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            Agregá un ejercicio para empezar tu entrenamiento.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {draft.entries.map((entry, entryIdx) => {
            const fields = fieldsFor(entry.exercise);
            return (
              <div key={entry.exercise.id} className="overflow-hidden rounded-3xl border border-border bg-card">
                {/* Header del ejercicio */}
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onExerciseInfo(entry.exercise)}
                    className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border bg-white transition-transform hover:scale-105"
                    aria-label={`Ver detalle de ${entry.exercise.name}`}
                  >
                    {entry.exercise.image_url ? (
                      <img src={entry.exercise.image_url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-text-tertiary">
                        <Icon name="Dumbbell" size={17} />
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onExerciseInfo(entry.exercise)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-black text-primary">{entry.exercise.name}</p>
                    <p className="truncate text-xs font-semibold text-text-tertiary">
                      {entry.exercise.primary_muscle || entry.exercise.muscle_group || ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeEntry(entryIdx)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-error-light hover:text-error"
                    aria-label={`Quitar ${entry.exercise.name}`}
                  >
                    <Icon name="Trash2" size={16} />
                  </button>
                </div>

                {/* Grilla de series */}
                <div className="px-4 py-3">
                  <div
                    className="grid items-center gap-2 pb-2"
                    style={{ gridTemplateColumns: `2.25rem repeat(${fields.length}, minmax(0,1fr)) 2.5rem 2.25rem` }}
                  >
                    <p className="text-center text-[10px] font-black uppercase tracking-widest text-text-tertiary">Serie</p>
                    {fields.map((f) => (
                      <p key={f} className="text-center text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                        {FIELD_LABELS[f]}
                      </p>
                    ))}
                    <span />
                    <span />
                  </div>

                  <div className="space-y-2">
                    {entry.sets.map((set, setIdx) => (
                      <div
                        key={set.id}
                        className={`grid items-center gap-2 rounded-2xl px-0 py-1 transition-colors ${set.done ? 'bg-success-light/60' : ''}`}
                        style={{ gridTemplateColumns: `2.25rem repeat(${fields.length}, minmax(0,1fr)) 2.5rem 2.25rem` }}
                      >
                        <p className="text-center text-sm font-black text-text-secondary">{setIdx + 1}</p>
                        {fields.map((f) => (
                          <SetInput
                            key={f}
                            value={set[f]}
                            onChange={(v) => updateSet(entryIdx, setIdx, { [f]: v })}
                            placeholder="—"
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => updateSet(entryIdx, setIdx, { done: !set.done })}
                          disabled={!setHasValue(set, fields)}
                          className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                            set.done
                              ? 'bg-success text-white'
                              : setHasValue(set, fields)
                                ? 'bg-muted text-text-tertiary hover:bg-success/15 hover:text-success'
                                : 'cursor-not-allowed bg-muted text-text-tertiary/40'
                          }`}
                          aria-label={set.done ? 'Marcar serie como pendiente' : 'Completar serie'}
                        >
                          <Icon name="Check" size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSet(entryIdx, setIdx)}
                          className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-text-tertiary/60 transition-colors hover:bg-muted hover:text-error"
                          aria-label="Eliminar serie"
                        >
                          <Icon name="X" size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => addSet(entryIdx)}
                    className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl bg-muted text-xs font-black uppercase tracking-wide text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Icon name="Plus" size={15} />
                    Agregar serie
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Acciones inferiores */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={onAddExercisesClick}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-black text-white shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          <Icon name="Plus" size={17} />
          Agregar ejercicio
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-muted text-sm font-black text-error transition-colors hover:bg-error-light"
        >
          Descartar entrenamiento
        </button>
      </div>
    </div>
  );
};

export { fieldsFor, setHasValue };
export default ActiveWorkout;
