import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../../components/AppIcon';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../components/ui/Tabs';
import { useToast } from '../../../../hooks/useToast';
import { useConfirm } from '../../../../components/ui/ConfirmProvider';
import ExerciseBrowser from '../../../exercise-library/components/ExerciseBrowser';
import ActiveWorkout, { createEntry, setToPayload } from './ActiveWorkout';
import ExercisePickerModal from './ExercisePickerModal';
import WorkoutExerciseDetailModal from './WorkoutExerciseDetailModal';
import { saveWorkout, fetchRecentWorkouts, computeVolume } from '../../../../services/workouts';
import { formatearFecha } from '../../../../utils/formatters';

const draftKey = (athleteId) => `dmgfit_workout_draft_${athleteId}`;

const loadDraft = (athleteId) => {
  try {
    const raw = localStorage.getItem(draftKey(athleteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.startedAt || !Array.isArray(parsed.entries)) return null;
    // Compatibilidad con borradores previos al soporte de pausa.
    if (parsed.segmentStart === undefined) parsed.segmentStart = parsed.startedAt;
    if (parsed.accumulatedSec === undefined) parsed.accumulatedSec = 0;
    return parsed;
  } catch {
    return null;
  }
};

const sessionDurationLabel = (session) => {
  if (!session.started_at || !session.ended_at) return null;
  const sec = Math.max(0, Math.floor((new Date(session.ended_at) - new Date(session.started_at)) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${m}min` : `${m}min`;
};

const formatResultLine = (row) => {
  if (row.load_done != null && row.reps_done != null) return `${row.load_done} kg × ${row.reps_done}`;
  if (row.reps_done != null) return `${row.reps_done} reps`;
  const parts = [];
  if (row.distance_m != null) parts.push(`${(row.distance_m / 1000).toLocaleString('es-AR')} km`);
  if (row.time_sec != null) {
    const m = Math.floor(row.time_sec / 60);
    const s = row.time_sec % 60;
    parts.push(m ? `${m}min${s ? ` ${s}s` : ''}` : `${s}s`);
  }
  return parts.join(' · ') || '—';
};

const SessionCard = ({ session }) => {
  const [expanded, setExpanded] = useState(false);
  const results = session.workout_results ?? [];
  const volume = computeVolume(results);
  const duration = sessionDurationLabel(session);

  const byExercise = useMemo(() => {
    const map = new Map();
    results.forEach((row) => {
      const key = row.exercise_id;
      if (!map.has(key)) map.set(key, { exercise: row.exercises, sets: [] });
      map.get(key).sets.push(row);
    });
    map.forEach((g) => g.sets.sort((a, b) => a.set_index - b.set_index));
    return [...map.values()];
  }, [results]);

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-text-primary">{session.title || 'Entrenamiento'}</p>
          <p className="mt-0.5 text-xs font-semibold text-text-tertiary">
            {session.session_date ? formatearFecha(session.session_date) : ''}
            {duration ? ` · ${duration}` : ''}
            {volume ? ` · ${volume.toLocaleString('es-AR')} kg` : ''}
            {` · ${results.length} series`}
          </p>
        </div>
        <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={18} className="shrink-0 text-text-tertiary" />
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-border px-5 py-4">
          {byExercise.map((group, i) => (
            <div key={group.exercise?.id || i}>
              <div className="mb-1.5 flex items-center gap-2.5">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-white">
                  {group.exercise?.image_url ? (
                    <img src={group.exercise.image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-text-tertiary">
                      <Icon name="Dumbbell" size={14} />
                    </span>
                  )}
                </div>
                <p className="truncate text-sm font-black text-text-primary">
                  {group.exercise?.name || 'Ejercicio'}
                </p>
              </div>
              <div className="ml-[46px] space-y-0.5">
                {group.sets.map((row) => (
                  <p key={row.id} className="text-xs font-semibold text-text-secondary">
                    <span className="mr-2 inline-block w-4 text-center font-black text-text-tertiary">{row.set_index}</span>
                    {formatResultLine(row)}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/**
 * Sección "Entrenar" del portal del atleta (flujo estilo Hevy):
 * empezar entrenamiento vacío → agregar ejercicios (con detalle GIF/historia/
 * indicaciones) → registrar series → terminar → resumen + historial.
 * El borrador sobrevive recargas (localStorage).
 */
const WorkoutSection = ({ athleteId }) => {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [draft, setDraft] = useState(null);
  const [recent, setRecent] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [infoExercise, setInfoExercise] = useState(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(null);

  // Restaurar borrador al montar.
  useEffect(() => {
    if (!athleteId) return;
    setDraft(loadDraft(athleteId));
  }, [athleteId]);

  // Persistir borrador ante cada cambio.
  const updateDraft = (next) => {
    setDraft(next);
    try {
      if (next) localStorage.setItem(draftKey(athleteId), JSON.stringify(next));
      else localStorage.removeItem(draftKey(athleteId));
    } catch { /* storage lleno o bloqueado: seguimos en memoria */ }
  };

  const refreshRecent = async () => {
    if (!athleteId) return;
    try {
      setRecent(await fetchRecentWorkouts(athleteId));
    } catch (e) {
      console.error('Error cargando entrenamientos:', e);
      setRecent([]);
    }
  };

  useEffect(() => { refreshRecent(); }, [athleteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const recentExerciseIds = useMemo(() => {
    const ids = [];
    (recent ?? []).forEach((s) => (s.workout_results ?? []).forEach((r) => {
      if (r.exercise_id && !ids.includes(r.exercise_id)) ids.push(r.exercise_id);
    }));
    return ids;
  }, [recent]);

  const startWorkout = () => {
    const nowIso = new Date().toISOString();
    updateDraft({ title: 'Entrenamiento', startedAt: nowIso, segmentStart: nowIso, accumulatedSec: 0, entries: [] });
    setJustSaved(null);
    setPickerOpen(true);
  };

  const addExercises = (exercises) => {
    if (!draft) return;
    const existing = new Set(draft.entries.map((e) => e.exercise.id));
    const added = exercises.filter((ex) => !existing.has(ex.id)).map(createEntry);
    updateDraft({ ...draft, entries: [...draft.entries, ...added] });
  };

  const finishWorkout = async () => {
    if (!draft) return;
    const entries = draft.entries
      .map((entry) => ({ ...entry, sets: entry.sets.filter((s) => s.done).map(setToPayload) }))
      .filter((entry) => entry.sets.length > 0);
    if (!entries.length) {
      toast.error('Marcá al menos una serie con ✓ para poder terminar (o descartá el entrenamiento).');
      return;
    }

    const ok = await confirm({
      title: 'Terminar entrenamiento',
      message: 'Se guardan las series completadas (✓). ¿Cerramos la sesión?',
      confirmLabel: 'Terminar y guardar',
    });
    if (!ok) return;

    // Duración efectiva (descuenta pausas): ended_at = inicio + tiempo activo.
    const activeSec =
      (draft.accumulatedSec || 0) +
      (draft.segmentStart ? Math.max(0, (Date.now() - new Date(draft.segmentStart).getTime()) / 1000) : 0);
    const endedAt = new Date(new Date(draft.startedAt).getTime() + Math.round(activeSec) * 1000).toISOString();

    try {
      setSaving(true);
      await saveWorkout({
        athleteId,
        title: draft.title,
        startedAt: draft.startedAt,
        endedAt,
        entries,
      });
      setJustSaved({ title: draft.title || 'Entrenamiento', entries });
      updateDraft(null);
      toast.success('Entrenamiento guardado 💪');
      refreshRecent();
    } catch (e) {
      console.error('Error guardando entrenamiento:', e);
      toast.error(e?.message || 'No se pudo guardar el entrenamiento.');
    } finally {
      setSaving(false);
    }
  };

  const discardWorkout = async () => {
    const ok = await confirm({
      title: 'Descartar entrenamiento',
      message: 'Se pierde todo lo registrado en esta sesión. ¿Seguro?',
      confirmLabel: 'Descartar',
      variant: 'danger',
    });
    if (!ok) return;
    updateDraft(null);
  };

  return (
    <Tabs defaultValue="entrenar">
      <TabsList className="mb-5">
        <TabsTrigger value="entrenar" iconName="Dumbbell">Entrenar</TabsTrigger>
        <TabsTrigger value="biblioteca" iconName="BookOpen">Biblioteca</TabsTrigger>
      </TabsList>

      <TabsContent value="entrenar">
        {draft ? (
          <ActiveWorkout
            draft={draft}
            onChange={updateDraft}
            onAddExercisesClick={() => setPickerOpen(true)}
            onExerciseInfo={setInfoExercise}
            onFinish={finishWorkout}
            onDiscard={discardWorkout}
            saving={saving}
          />
        ) : (
          <div className="space-y-6">
            {justSaved ? (
              <div className="rounded-3xl border border-success/25 bg-success-light px-5 py-4">
                <p className="flex items-center gap-2 text-sm font-black text-success">
                  <Icon name="CheckCircle2" size={17} />
                  ¡{justSaved.title} guardado!
                </p>
                <p className="mt-0.5 text-xs font-semibold text-text-secondary">
                  Lo tenés abajo en tu historial, y suma a la historia de cada ejercicio.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={startWorkout}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-3xl bg-primary text-base font-black text-white shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <Icon name="Plus" size={19} />
              Empezar entrenamiento vacío
            </button>

            <section>
              <p className="mb-3 ml-1 text-xs font-black uppercase tracking-widest text-text-tertiary">
                Mis entrenamientos
              </p>
              {recent === null ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-3xl bg-muted" />
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-10 text-center">
                  <Icon name="History" size={30} className="mx-auto mb-2 text-text-tertiary" />
                  <p className="text-sm font-black text-text-primary">Todavía no registraste entrenamientos</p>
                  <p className="mt-1 text-xs font-medium text-text-secondary">
                    Arrancá con "Empezar entrenamiento vacío" y registrá tus series.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recent.map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </TabsContent>

      <TabsContent value="biblioteca">
        <ExerciseBrowser
          title="Biblioteca de ejercicios"
          subtitle="Explorá el catálogo, mirá la ejecución y aprendé la técnica de cada movimiento."
        />
      </TabsContent>

      <ExercisePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={addExercises}
        onInfo={setInfoExercise}
        recentIds={recentExerciseIds}
        excludeIds={(draft?.entries ?? []).map((e) => e.exercise.id)}
      />

      <WorkoutExerciseDetailModal
        exercise={infoExercise}
        athleteId={athleteId}
        open={Boolean(infoExercise)}
        onClose={() => setInfoExercise(null)}
      />
    </Tabs>
  );
};

export default WorkoutSection;
