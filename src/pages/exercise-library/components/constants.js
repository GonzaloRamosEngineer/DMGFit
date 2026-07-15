export const CATEGORY_LABELS = {
  strength: 'Fuerza',
  cardio: 'Cardio',
  mobility: 'Movilidad',
  stretching: 'Estiramiento',
  skill: 'Técnica',
  other: 'Otro',
};

export const TRACKING_LABELS = {
  reps_weight: 'Series + peso',
  reps: 'Repeticiones',
  time: 'Tiempo',
  distance: 'Distancia',
  time_distance: 'Tiempo + distancia',
  bodyweight: 'Peso corporal',
  assisted_bodyweight: 'Asistido',
};

// La media (GIF + thumbnail) proviene de Gym visual, redistribuida con permiso.
// Su licencia exige mantener visible esta atribución.
export const MEDIA_ATTRIBUTION = '© Gym visual — gymvisual.com';

export const CATEGORY_ICONS = {
  cardio: 'HeartPulse',
  mobility: 'Move',
  stretching: 'StretchHorizontal',
  skill: 'Sparkles',
};

export const iconForExercise = (exercise) =>
  CATEGORY_ICONS[exercise?.category] || 'Dumbbell';
