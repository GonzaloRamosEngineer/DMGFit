import React from 'react';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import Icon from '../../../components/AppIcon';
import ExerciseThumb from './ExerciseThumb';
import MediaCredit from './MediaCredit';
import { CATEGORY_LABELS, TRACKING_LABELS } from './constants';

const InfoPill = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
    <Icon name={icon} size={15} className="shrink-0 text-primary" />
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">{label}</p>
      <p className="truncate text-xs font-bold text-text-primary">{value}</p>
    </div>
  </div>
);

const ExerciseDetailModal = ({ exercise, open, onClose }) => {
  if (!exercise) return null;

  const muscle = exercise.primary_muscle || exercise.muscle_group || 'Sin grupo';
  const category = CATEGORY_LABELS[exercise.category] || exercise.category || 'Catálogo';
  const tracking = TRACKING_LABELS[exercise.tracking_type] || exercise.tracking_type || 'Registro';
  const secondary = Array.isArray(exercise.secondary_muscles) ? exercise.secondary_muscles : [];
  const steps = (exercise.instructions || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const hasMedia = Boolean(exercise.video_url || exercise.image_url);

  return (
    <Modal open={open} onClose={onClose} title={exercise.name} subtitle={`${muscle} · ${category}`} size="xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <div className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl border border-border bg-white">
            <ExerciseThumb exercise={exercise} size="lg" play />
            {hasMedia ? <MediaCredit className="absolute bottom-1.5 right-1.5" /> : null}
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <InfoPill icon="Target" label="Músculo" value={muscle} />
            <InfoPill icon="Dumbbell" label="Equipo" value={exercise.equipment || '—'} />
            <InfoPill icon="Layers3" label="Categoría" value={category} />
            <InfoPill icon="ClipboardList" label="Registro" value={tracking} />
          </div>

          {secondary.length ? (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                Músculos secundarios
              </p>
              <div className="flex flex-wrap gap-1.5">
                {secondary.map((m) => (
                  <Badge key={m} variant="neutral" size="sm">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-text-tertiary">
              <Icon name="ListOrdered" size={13} className="text-primary" />
              Cómo se hace
            </p>
            {steps.length ? (
              <ol className="space-y-2">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-black text-primary">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium leading-relaxed text-text-secondary">{step}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm font-medium leading-relaxed text-text-tertiary">
                Sin instrucciones cargadas para este ejercicio.
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ExerciseDetailModal;
