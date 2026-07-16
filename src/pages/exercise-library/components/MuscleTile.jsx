import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

/**
 * Tile de descubrimiento por grupo muscular. Muestra un ejercicio representativo
 * (thumbnail que pasa a GIF en hover) con overlay y el conteo del grupo.
 */
const MuscleTile = ({ muscle, count, sample, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const hasThumb = sample?.image_url && !imgError;
  const showGif = hovered && sample?.video_url;

  return (
    <button
      type="button"
      onClick={() => onClick?.(muscle)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex aspect-[4/5] w-full flex-col justify-end overflow-hidden rounded-3xl border border-border bg-muted text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-32px_rgba(15,23,42,0.4)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {hasThumb ? (
        <div className="absolute inset-0 bg-white">
          <img
            src={sample.image_url}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={() => setImgError(true)}
            className={`h-full w-full object-contain p-4 transition-all duration-500 group-hover:scale-105 ${showGif ? 'opacity-0' : 'opacity-100'}`}
          />
          {showGif ? (
            <img
              src={sample.video_url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-contain p-4"
            />
          ) : null}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
          <Icon name="Dumbbell" size={56} />
        </div>
      )}

      {/* Overlay inferior para legibilidad */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

      <div className="relative z-10 p-4">
        <h3 className="text-base font-black leading-tight text-white drop-shadow-sm">{muscle}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-white/80">
          {count} {count === 1 ? 'ejercicio' : 'ejercicios'}
          <Icon name="ArrowRight" size={13} className="transition-transform duration-300 group-hover:translate-x-1" />
        </p>
      </div>
    </button>
  );
};

export default MuscleTile;
