import { supabase } from '../lib/supabaseClient';

export const fetchExercises = async ({
  search = '',
  muscle = 'all',
  equipment = 'all',
  category = 'all',
  limit = 500,
} = {}) => {
  // Solo ejercicios con imagen representativa: los que no tienen media se ocultan
  // de la biblioteca y del armador de rutinas (mismo servicio).
  let query = supabase
    .from('exercises')
    .select('*')
    .not('image_url', 'is', null)
    .neq('image_url', '')
    .order('name', { ascending: true })
    .limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  const normalizedSearch = search.trim().toLowerCase();

  return (data ?? []).filter((exercise) => {
    const exerciseMuscle = exercise.primary_muscle || exercise.muscle_group || '';
    const matchesSearch = !normalizedSearch
      || [exercise.name, exerciseMuscle, exercise.equipment, exercise.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    const matchesMuscle = muscle === 'all' || exerciseMuscle === muscle;
    const matchesEquipment = equipment === 'all' || exercise.equipment === equipment;
    const matchesCategory = category === 'all' || exercise.category === category;

    return matchesSearch && matchesMuscle && matchesEquipment && matchesCategory;
  });
};

export const getExerciseFacets = (exercises = []) => {
  const muscles = new Set();
  const equipment = new Set();
  const categories = new Set();

  exercises.forEach((exercise) => {
    const muscle = exercise.primary_muscle || exercise.muscle_group;
    if (muscle) muscles.add(muscle);
    if (exercise.equipment) equipment.add(exercise.equipment);
    if (exercise.category) categories.add(exercise.category);
  });

  return {
    muscles: [...muscles].sort((a, b) => a.localeCompare(b, 'es')),
    equipment: [...equipment].sort((a, b) => a.localeCompare(b, 'es')),
    categories: [...categories].sort((a, b) => a.localeCompare(b, 'es')),
  };
};
