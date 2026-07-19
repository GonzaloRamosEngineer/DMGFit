import React from 'react';
import { MEDIA_ATTRIBUTION } from './constants';

/**
 * Crédito de la media (licencia Gym visual) en forma discreta: un "?" que
 * muestra la atribución al pasar el mouse / mantener pulsado. Cumple el
 * requisito de la licencia (crédito accesible) sin ensuciar la interfaz.
 */
const MediaCredit = ({ className = '' }) => (
  <span
    role="img"
    title={MEDIA_ATTRIBUTION}
    aria-label={MEDIA_ATTRIBUTION}
    className={`inline-flex h-5 w-5 cursor-help select-none items-center justify-center rounded-full bg-black/30 text-[11px] font-bold leading-none text-white/90 backdrop-blur-sm transition-colors hover:bg-black/55 ${className}`}
  >
    ?
  </span>
);

export default MediaCredit;
