import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import Icon from '../../../../components/AppIcon';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../components/ui/Tabs';
import ExerciseThumb from '../../../exercise-library/components/ExerciseThumb';
import { MEDIA_ATTRIBUTION } from '../../../exercise-library/components/constants';
import { fetchExerciseHistory } from '../../../../services/workouts';
import { formatearFecha } from '../../../../utils/formatters';

const formatSet = (set) => {
  const parts = [];
  if (set.load_done != null && set.reps_done != null) parts.push(`${set.load_done} kg × ${set.reps_done}`);
  else if (set.reps_done != null) parts.push(`${set.reps_done} reps`);
  if (set.time_sec != null) {
    const m = Math.floor(set.time_sec / 60);
    const s = set.time_sec % 60;
    parts.push(m ? `${m}min ${s ? `${s}s` : ''}`.trim() : `${s}s`);
  }
  if (set.distance_m != null) parts.push(`${(set.distance_m / 1000).toLocaleString('es-AR')} km`);
  return parts.join(' · ') || '—';
};

/**
 * Detalle de un ejercicio dentro del flujo de entrenamiento, con pestañas
 * Resumen (GIF + músculos/equipo), Historia (series registradas por sesión)
 * e Indicaciones (pasos numerados).
 */
const WorkoutExerciseDetailModal = ({ exercise, athleteId, open, onClose }) => {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    if (!open || !exercise || !athleteId) return;
    let mounted = true;
    setHistory(null);
    fetchExerciseHistory(athleteId, exercise.id)
      .then((data) => { if (mounted) setHistory(data); })
      .catch((e) => { console.error('Error cargando historial:', e); if (mounted) setHistory([]); });
    return () => { mounted = false; };
  }, [open, exercise, athleteId]);

  const steps = useMemo(
    () => (exercise?.instructions || '').split('\n').map((s) => s.trim()).filter(Boolean),
    [exercise]
  );

  if (!exercise) return null;
  const secondary = Array.isArray(exercise.secondary_muscles) ? exercise.secondary_muscles : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={exercise.name}
      subtitle={exercise.primary_muscle || exercise.muscle_group || ''}
      size="lg"
    >
      <Tabs defaultValue="resumen">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="resumen" className="flex-1 justify-center">Resumen</TabsTrigger>
          <TabsTrigger value="historia" className="flex-1 justify-center">Historia</TabsTrigger>
          <TabsTrigger value="indicaciones" className="flex-1 justify-center">Indicaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <div className="space-y-4">
            <div className="mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border border-border bg-white">
              <ExerciseThumb exercise={exercise} size="lg" play />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {exercise.equipment ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-black uppercase tracking-wide text-text-secondary">
                  <Icon name="Dumbbell" size={13} />
                  {exercise.equipment}
                </span>
              ) : null}
              {secondary.slice(0, 4).map((m) => (
                <span key={m} className="rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-text-tertiary">
                  {m}
                </span>
              ))}
            </div>
            {exercise.image_url ? (
              <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                {MEDIA_ATTRIBUTION}
              </p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="historia">
          {history === null ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center">
              <Icon name="History" size={32} className="mx-auto mb-2 text-text-tertiary" />
              <p className="text-sm font-bold text-text-primary">Todavía sin registros</p>
              <p className="text-xs font-medium text-text-tertiary">
                Cuando registres este ejercicio en un entrenamiento, vas a ver acá tu progreso.
              </p>
            </div>
          ) : (
            <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
              {history.map((session) => (
                <div key={session.sessionId} className="rounded-2xl border border-border p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-black text-text-primary">{session.title}</p>
                    <p className="shrink-0 text-xs font-bold text-text-tertiary">
                      {session.date ? formatearFecha(session.date) : ''}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {session.sets.map((set) => (
                      <div key={set.id} className="flex items-center gap-3 text-sm">
                        <span className="w-6 shrink-0 text-center font-black text-text-tertiary">{set.set_index}</span>
                        <span className="font-semibold text-text-secondary">{formatSet(set)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="indicaciones">
          {steps.length ? (
            <ol className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium leading-relaxed text-text-secondary">{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-center text-sm font-medium text-text-tertiary">
              Sin indicaciones cargadas para este ejercicio.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </Modal>
  );
};

export default WorkoutExerciseDetailModal;
