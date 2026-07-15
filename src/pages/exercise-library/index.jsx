import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Icon from '../../components/AppIcon';
import Input from '../../components/ui/Input';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { fetchExercises, getExerciseFacets } from '../../services/exercises';
import ExerciseCard from './components/ExerciseCard';
import ExerciseDetailModal from './components/ExerciseDetailModal';
import { CATEGORY_LABELS, MEDIA_ATTRIBUTION } from './components/constants';

const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const SelectFilter = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-text-tertiary">
      {label}
    </span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm font-semibold text-text-primary outline-none transition-colors focus:border-primary"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const ExerciseLibrary = () => {
  const [allExercises, setAllExercises] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadExercises = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchExercises({ limit: 1000 });
        if (isMounted) {
          setAllExercises(data);
          setExercises(data);
        }
      } catch (loadError) {
        console.error('Error cargando biblioteca de ejercicios:', loadError);
        if (isMounted) setError(loadError?.message || 'No se pudo cargar la biblioteca.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadExercises();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const searchTerm = normalize(search.trim());
    const filtered = allExercises.filter((exercise) => {
      const exerciseMuscle = exercise.primary_muscle || exercise.muscle_group || '';
      const searchableText = normalize([
        exercise.name,
        exerciseMuscle,
        exercise.equipment,
        exercise.category,
      ].filter(Boolean).join(' '));

      const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
      const matchesMuscle = muscle === 'all' || exerciseMuscle === muscle;
      const matchesEquipment = equipment === 'all' || exercise.equipment === equipment;
      const matchesCategory = category === 'all' || exercise.category === category;

      return matchesSearch && matchesMuscle && matchesEquipment && matchesCategory;
    });

    setExercises(filtered);
  }, [allExercises, category, equipment, muscle, search]);

  const facets = useMemo(() => getExerciseFacets(allExercises), [allExercises]);
  const muscleOptions = useMemo(
    () => [{ value: 'all', label: 'Todos los músculos' }, ...facets.muscles.map((item) => ({ value: item, label: item }))],
    [facets.muscles]
  );
  const equipmentOptions = useMemo(
    () => [{ value: 'all', label: 'Todo el equipamiento' }, ...facets.equipment.map((item) => ({ value: item, label: item }))],
    [facets.equipment]
  );
  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'Todas las categorías' },
      ...facets.categories.map((item) => ({ value: item, label: CATEGORY_LABELS[item] || item })),
    ],
    [facets.categories]
  );

  const summary = useMemo(() => {
    const strengthCount = allExercises.filter((item) => item.category === 'strength').length;
    const cardioCount = allExercises.filter((item) => item.category === 'cardio').length;
    return [
      { label: 'Ejercicios', value: allExercises.length, icon: 'Dumbbell' },
      { label: 'Músculos', value: facets.muscles.length, icon: 'ScanBody' },
      { label: 'Fuerza', value: strengthCount, icon: 'Activity' },
      { label: 'Cardio', value: cardioCount, icon: 'HeartPulse' },
    ];
  }, [allExercises, facets.muscles.length]);

  return (
    <>
      <Helmet>
        <title>Biblioteca de Ejercicios | VC Fit</title>
      </Helmet>

      <div className="mx-auto max-w-[1500px] space-y-6 px-5 pb-16 md:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-text-tertiary">
              Biblioteca
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-text-primary md:text-4xl">
              Ejercicios
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-text-secondary">
              Catálogo base para crear rutinas, asignar sesiones y medir progreso por movimiento.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold text-text-secondary">
            {exercises.length} visibles de {allExercises.length}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {summary.map((item) => (
            <Card key={item.label} padding="none" className="rounded-2xl">
              <CardBody className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon name={item.icon} size={20} />
                </div>
                <div>
                  <p className="text-xl font-black text-text-primary">{item.value}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">{item.label}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
          <Card padding="none" className="rounded-2xl">
            <CardHeader className="mb-0 border-b border-border p-5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Icon name="Search" size={18} className="text-primary" />
                Explorar biblioteca
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 p-5">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar press, sentadilla, bíceps..."
                className="h-12 rounded-xl"
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <SelectFilter label="Músculo" value={muscle} onChange={setMuscle} options={muscleOptions} />
                <SelectFilter label="Equipo" value={equipment} onChange={setEquipment} options={equipmentOptions} />
                <SelectFilter label="Tipo" value={category} onChange={setCategory} options={categoryOptions} />
              </div>

              {loading ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-2xl bg-muted" />
                  ))}
                </div>
              ) : error ? (
                <EmptyState
                  iconName="AlertTriangle"
                  title="No se pudo cargar la biblioteca"
                  description={error}
                />
              ) : exercises.length === 0 ? (
                <EmptyState
                  iconName="SearchX"
                  title="Sin resultados"
                  description="Probá limpiar filtros o buscar por otro nombre."
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {exercises.map((exercise) => (
                    <ExerciseCard
                      key={exercise.id || exercise.slug || exercise.name}
                      exercise={exercise}
                      onSelect={setSelected}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <aside className="space-y-5">
            <Card padding="none" className="rounded-2xl">
              <CardHeader className="mb-0 p-6 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Icon name="Layers3" size={18} className="text-primary" />
                  Siguiente paso
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-3 px-6 pb-6 text-sm font-medium leading-relaxed text-text-secondary">
                <p>
                  Esta base ya puede alimentar el selector de rutinas, sesiones y estadísticas por ejercicio.
                </p>
                <div className="rounded-xl bg-muted p-3 text-xs font-bold uppercase tracking-wider text-text-tertiary">
                  Rutinas + PRs + volumen semanal
                </div>
              </CardBody>
            </Card>

            <Card padding="none" className="rounded-2xl">
              <CardHeader className="mb-0 p-6 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Icon name="PlayCircle" size={18} className="text-primary" />
                  Media
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-2 px-6 pb-6 text-xs font-semibold leading-relaxed text-text-tertiary">
                <p>Cada ejercicio incluye animación de la ejecución e instrucciones paso a paso. Pasá el mouse sobre la miniatura o abrí el detalle.</p>
                <p className="text-text-secondary">{MEDIA_ATTRIBUTION}</p>
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>

      <ExerciseDetailModal
        exercise={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </>
  );
};

export default ExerciseLibrary;
