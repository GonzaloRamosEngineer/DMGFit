import React from 'react';
import Icon from '../../../components/AppIcon';
import ExerciseThumb from './ExerciseThumb';
import { CATEGORY_LABELS, TRACKING_LABELS } from './constants';

const ExerciseCard = ({ exercise, onSelect }) => {
  const muscle = exercise.primary_muscle || exercise.muscle_group || 'Sin grupo';
  const category = CATEGORY_LABELS[exercise.category] || exercise.category || 'Catálogo';
  const tracking = TRACKING_LABELS[exercise.tracking_type] || exercise.tracking_type || 'Registro';
  const hasMedia = Boolean(exercise.image_url);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(exercise)}
      className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <ExerciseThumb exercise={exercise} size="md" />

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-black text-text-primary">{exercise.name}</h3>
        <p className="mt-1 truncate text-xs font-semibold text-text-tertiary">
          {muscle}
          {exercise.equipment ? ` · ${exercise.equipment}` : ''}
        </p>
        {hasMedia ? (
          <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-primary opacity-0 transition-opacity group-hover:opacity-100">
            <Icon name="PlayCircle" size={12} />
            Ver ejecución
          </span>
        ) : null}
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-text-secondary">
          {category}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
          {tracking}
        </span>
      </div>
    </button>
  );
};

export default ExerciseCard;
