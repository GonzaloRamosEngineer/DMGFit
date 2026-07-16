import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { useInView } from './useInView';
import { iconForExercise, TRACKING_LABELS } from './constants';

/**
 * Card visual (GIF al frente) para la grilla de ejercicios.
 * El GIF se descarga/anima cuando la card está en viewport (mobile) o al hover
 * (desktop). Sin media, cae a un ícono elegante.
 */
const ExerciseGridCard = ({ exercise, onSelect }) => {
  const [ref, inView] = useInView({ rootMargin: '200px' });
  const [hovered, setHovered] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const [gifError, setGifError] = useState(false);

  const muscle = exercise.primary_muscle || exercise.muscle_group || 'Sin grupo';
  const tracking = TRACKING_LABELS[exercise.tracking_type];
  const hasThumb = exercise.image_url && !thumbError;
  const wantsGif = (inView || hovered) && exercise.video_url && !gifError;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect?.(exercise)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-white">
        {hasThumb ? (
          <>
            <img
              src={exercise.image_url}
              alt={exercise.name}
              loading="lazy"
              onError={() => setThumbError(true)}
              className={`h-full w-full object-contain transition-opacity duration-300 ${wantsGif ? 'opacity-0' : 'opacity-100'}`}
            />
            {wantsGif ? (
              <img
                src={exercise.video_url}
                alt=""
                aria-hidden="true"
                onError={() => setGifError(true)}
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : null}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-text-tertiary">
            <Icon name={iconForExercise(exercise)} size={52} />
          </div>
        )}

        {/* Chip de músculo, flotante */}
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-sm">
          {muscle}
        </span>

        {exercise.video_url ? (
          <span className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-primary opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
            <Icon name="Play" size={15} />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-sm font-black leading-snug text-text-primary">
          {exercise.name}
        </h3>
        <p className="mt-auto flex items-center gap-1.5 truncate text-xs font-semibold text-text-tertiary">
          {exercise.equipment ? (
            <>
              <Icon name="Dumbbell" size={12} />
              {exercise.equipment}
            </>
          ) : (
            tracking || '—'
          )}
        </p>
      </div>
    </button>
  );
};

export default ExerciseGridCard;
