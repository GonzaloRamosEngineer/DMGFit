import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { iconForExercise } from './constants';

/**
 * Thumbnail estático que reproduce el GIF de la ejecución al hacer hover
 * (o siempre, si `play` es true — útil dentro del modal de detalle).
 * El GIF se descarga recién cuando hace falta, para no traer cientos de
 * animaciones de golpe en la grilla.
 */
const ExerciseThumb = ({ exercise, size = 'md', play = false, className = '' }) => {
  const [hovered, setHovered] = useState(false);
  const [gifError, setGifError] = useState(false);
  const [imgError, setImgError] = useState(false);

  const dims = { sm: 'h-12 w-12', md: 'h-16 w-16', lg: 'h-full w-full' }[size] || 'h-16 w-16';
  const showGif = (play || hovered) && exercise?.video_url && !gifError;
  const hasThumb = exercise?.image_url && !imgError;

  if (!hasThumb) {
    return (
      <div
        className={`flex ${dims} shrink-0 items-center justify-center rounded-2xl bg-muted text-text-secondary ${className}`}
      >
        <Icon name={iconForExercise(exercise)} size={size === 'lg' ? 48 : 22} />
      </div>
    );
  }

  return (
    <div
      className={`relative ${dims} shrink-0 overflow-hidden rounded-2xl bg-white ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={exercise.image_url}
        alt={exercise.name}
        loading="lazy"
        onError={() => setImgError(true)}
        className={`h-full w-full object-contain transition-opacity duration-200 ${showGif ? 'opacity-0' : 'opacity-100'}`}
      />
      {(play || hovered) && exercise?.video_url && !gifError ? (
        <img
          src={exercise.video_url}
          alt=""
          aria-hidden="true"
          onError={() => setGifError(true)}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${showGif ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : null}
    </div>
  );
};

export default ExerciseThumb;
