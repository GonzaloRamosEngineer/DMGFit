import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchExercises, getExerciseFacets } from '../../../services/exercises';

const CATEGORY_LABELS = {
  strength: 'Fuerza',
  cardio: 'Cardio',
  mobility: 'Movilidad',
  stretching: 'Estirar',
  skill: 'Tecnica',
  other: 'Otros',
};

const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const getExerciseMeta = (exercise) => {
  const muscle = exercise?.primary_muscle || exercise?.muscle_group || 'General';
  const equipment = exercise?.equipment || 'Sin equipo';
  return `${muscle} · ${equipment}`;
};

const ExerciseProgressSelector = ({ selectedExercise, onSelect, embedded = false, compact = false }) => {
  const [allExercises, setAllExercises] = useState([]);
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let isMounted = true;

    const loadExercises = async () => {
      try {
        setStatus('loading');
        const data = await fetchExercises({ limit: 1000 });
        if (isMounted) {
          setAllExercises(data);
          setStatus('idle');
        }
      } catch (error) {
        console.error('Error cargando ejercicios para progreso:', error);
        if (isMounted) setStatus('error');
      }
    };

    loadExercises();
    return () => { isMounted = false; };
  }, []);

  const facets = useMemo(() => getExerciseFacets(allExercises), [allExercises]);
  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos' },
      ...facets.categories.map((item) => ({
        value: item,
        label: CATEGORY_LABELS[item] || item,
      })),
    ],
    [facets.categories]
  );

  const visibleExercises = useMemo(() => {
    const term = normalize(search.trim());

    return allExercises
      .filter((exercise) => {
        const exerciseMuscle = exercise.primary_muscle || exercise.muscle_group || '';
        const searchable = normalize([
          exercise.name,
          exerciseMuscle,
          exercise.equipment,
          exercise.category,
        ].filter(Boolean).join(' '));

        return (
          (!term || searchable.includes(term)) &&
          (muscle === 'all' || exerciseMuscle === muscle) &&
          (category === 'all' || exercise.category === category)
        );
      })
      .slice(0, compact ? 5 : 7);
  }, [allExercises, category, compact, muscle, search]);

  return (
    <div className={embedded ? "min-w-0" : "rounded-3xl border border-border bg-card p-6 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.18)]"}>
      <div className={`${compact ? 'mb-3' : 'mb-5'} flex flex-col gap-3 md:flex-row md:items-start md:justify-between`}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-tertiary">
            Biblioteca integrada
          </p>
          <h3 className={`${compact ? 'text-base' : 'text-xl'} mt-1 flex items-center gap-2 font-black text-text-primary`}>
            <span className={`${compact ? 'h-8 w-8' : 'h-9 w-9'} flex items-center justify-center rounded-xl bg-primary/10 text-primary`}>
              <Icon name="Dumbbell" size={compact ? 16 : 18} />
            </span>
            Elegir ejercicio
          </h3>
        </div>

        <div className="rounded-2xl border border-border bg-muted px-3 py-2 text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
            Catalogo
          </p>
          <p className="text-sm font-black text-text-primary">{allExercises.length || '--'} items</p>
        </div>
      </div>

      {selectedExercise && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              Seleccionado
            </p>
            <p className="truncate text-sm font-black text-text-primary">{selectedExercise.name}</p>
            <p className="truncate text-xs font-semibold text-text-secondary">
              {getExerciseMeta(selectedExercise)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-text-secondary transition-colors hover:text-primary"
            aria-label="Limpiar ejercicio seleccionado"
            title="Limpiar seleccion"
          >
            <Icon name="X" size={16} />
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div className="relative">
          <Icon
            name="Search"
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar press, sentadilla, remo..."
            className={`${compact ? 'h-10' : 'h-12'} w-full rounded-2xl border border-border bg-muted pl-11 pr-4 text-sm font-bold text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-primary focus:bg-card`}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            value={muscle}
            onChange={(event) => setMuscle(event.target.value)}
            className={`${compact ? 'h-10' : 'h-11'} rounded-2xl border border-border bg-card px-3 text-sm font-bold text-text-primary outline-none focus:border-primary`}
          >
            <option value="all">Todos los musculos</option>
            {facets.muscles.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categoryOptions.slice(0, 5).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                className={`${compact ? 'h-10 px-3' : 'h-11 px-4'} whitespace-nowrap rounded-2xl border text-xs font-black transition-colors ${
                  category === item.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-border bg-card text-text-secondary hover:border-primary/40 hover:text-primary'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {status === 'loading' && Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={`${compact ? 'h-12' : 'h-16'} animate-pulse rounded-2xl bg-muted`} />
          ))}

          {status === 'error' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              No se pudo cargar la biblioteca de ejercicios.
            </div>
          )}

          {status === 'idle' && visibleExercises.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <Icon name="SearchX" size={22} className="mx-auto text-text-tertiary" />
              <p className="mt-2 text-sm font-black text-text-secondary">Sin resultados</p>
              <p className="text-xs font-semibold text-text-tertiary">Proba con otro nombre o filtro.</p>
            </div>
          )}

          {status === 'idle' && visibleExercises.map((exercise) => {
            const isSelected = selectedExercise?.id === exercise.id;
            return (
              <button
                key={exercise.id || exercise.slug || exercise.name}
                type="button"
                onClick={() => onSelect(exercise)}
                className={`flex w-full items-center gap-3 rounded-2xl border ${compact ? 'p-2.5' : 'p-3'} text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm'
                }`}
              >
                <span className={`flex ${compact ? 'h-9 w-9' : 'h-11 w-11'} shrink-0 items-center justify-center rounded-2xl ${
                  isSelected ? 'bg-primary text-white' : 'bg-muted text-text-secondary'
                }`}>
                  <Icon name={exercise.category === 'cardio' ? 'HeartPulse' : 'Dumbbell'} size={compact ? 16 : 18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-text-primary">
                    {exercise.name}
                  </span>
                  <span className="block truncate text-xs font-semibold text-text-tertiary">
                    {getExerciseMeta(exercise)}
                  </span>
                </span>
                <Icon
                  name={isSelected ? 'CheckCircle2' : 'ChevronRight'}
                  size={18}
                  className={isSelected ? 'text-primary' : 'text-text-tertiary'}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExerciseProgressSelector;
