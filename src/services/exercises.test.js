import { describe, it, expect } from 'vitest';
import { getExerciseFacets } from './exercises';

describe('getExerciseFacets', () => {
  const sample = [
    { primary_muscle: 'Pecho', equipment: 'Mancuerna', category: 'strength' },
    { primary_muscle: 'Espalda', equipment: 'Barra', category: 'strength' },
    { muscle_group: 'Pecho', equipment: 'Mancuerna', category: 'strength' }, // dup músculo/equipo
    { primary_muscle: 'Piernas', category: 'mobility' }, // sin equipo
  ];

  it('deduplica y ordena músculos (usa primary_muscle o muscle_group)', () => {
    const { muscles } = getExerciseFacets(sample);
    expect(muscles).toEqual(['Espalda', 'Pecho', 'Piernas']);
  });

  it('deduplica equipos e ignora los vacíos', () => {
    const { equipment } = getExerciseFacets(sample);
    expect(equipment).toEqual(['Barra', 'Mancuerna']);
  });

  it('junta categorías únicas', () => {
    const { categories } = getExerciseFacets(sample);
    expect(categories.sort()).toEqual(['mobility', 'strength']);
  });

  it('no rompe con lista vacía', () => {
    expect(getExerciseFacets()).toEqual({ muscles: [], equipment: [], categories: [] });
  });
});
