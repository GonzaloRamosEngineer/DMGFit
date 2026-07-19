import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { EmptyState } from '../../../components/ui/EmptyState';
import { fetchExercises } from '../../../services/exercises';
import ExerciseGridCard from './ExerciseGridCard';
import MuscleTile from './MuscleTile';
import ExerciseDetailModal from './ExerciseDetailModal';
import { CATEGORY_LABELS } from './constants';

const PAGE_SIZE = 48;

const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const CategoryChip = ({ active, onClick, children, icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition-all ${
      active
        ? 'bg-primary text-white shadow-sm'
        : 'bg-muted text-text-secondary hover:bg-muted/70'
    }`}
  >
    {icon ? <Icon name={icon} size={14} /> : null}
    {children}
  </button>
);

const ExerciseBrowser = ({ title = 'Ejercicios', subtitle }) => {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [muscle, setMuscle] = useState(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState(null);
  const gridTopRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchExercises({ limit: 1000 });
        if (mounted) setAll(data);
      } catch (e) {
        if (mounted) setError(e?.message || 'No se pudo cargar la biblioteca.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const categories = useMemo(() => {
    const present = new Set(all.map((e) => e.category).filter(Boolean));
    return ['all', ...['strength', 'cardio', 'mobility', 'stretching', 'skill', 'other'].filter((c) => present.has(c))];
  }, [all]);

  // Grupos musculares con conteo + ejercicio representativo (preferimos uno con GIF).
  const muscleGroups = useMemo(() => {
    const map = new Map();
    for (const ex of all) {
      const key = ex.primary_muscle || ex.muscle_group || 'Otro';
      if (!map.has(key)) map.set(key, { muscle: key, count: 0, sample: null });
      const g = map.get(key);
      g.count += 1;
      // Representativo: preferimos uno con imagen; y si el actual no tiene GIF, lo mejoramos por uno que sí.
      if (ex.image_url) {
        if (!g.sample) g.sample = ex;
        else if (!g.sample.video_url && ex.video_url) g.sample = ex;
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [all]);

  const results = useMemo(() => {
    const term = normalize(search.trim());
    return all.filter((ex) => {
      const m = ex.primary_muscle || ex.muscle_group || '';
      if (muscle && m !== muscle) return false;
      if (category !== 'all' && ex.category !== category) return false;
      if (!term) return true;
      const hay = normalize([ex.name, m, ex.equipment, (ex.aliases || []).join(' ')].filter(Boolean).join(' '));
      return hay.includes(term);
    });
  }, [all, search, category, muscle]);

  const browseMode = !search.trim() && category === 'all' && !muscle;

  // Reiniciar paginado al cambiar filtros.
  useEffect(() => { setVisible(PAGE_SIZE); }, [search, category, muscle]);

  const clearAll = () => { setSearch(''); setCategory('all'); setMuscle(null); };

  const activeContextLabel = muscle
    || (category !== 'all' ? CATEGORY_LABELS[category] || category : null)
    || (search.trim() ? `“${search.trim()}”` : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight text-text-primary md:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="max-w-2xl text-sm font-medium leading-relaxed text-text-secondary">{subtitle}</p>
        ) : null}
        {!loading && !error ? (
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-text-tertiary">
            {all.length} ejercicios con guía visual
          </p>
        ) : null}
      </div>

      {/* Buscador + chips (sticky) */}
      <div className="sticky top-0 z-10 -mx-1 space-y-3 bg-background/85 px-1 py-2 backdrop-blur-md">
        <div className="relative">
          <Icon name="Search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sentadilla, press, bíceps, banda…"
            className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-10 text-sm font-semibold text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-primary"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-tertiary hover:bg-muted"
              aria-label="Limpiar búsqueda"
            >
              <Icon name="X" size={16} />
            </button>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => (
            <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c === 'all' ? 'Todos' : CATEGORY_LABELS[c] || c}
            </CategoryChip>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      ) : error ? (
        <EmptyState iconName="AlertTriangle" title="No se pudo cargar la biblioteca" description={error} />
      ) : browseMode ? (
        <section ref={gridTopRef}>
          <p className="mb-3 ml-1 text-xs font-black uppercase tracking-widest text-text-tertiary">
            Explorá por grupo muscular
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {muscleGroups.map((g) => (
              <MuscleTile key={g.muscle} muscle={g.muscle} count={g.count} sample={g.sample} onClick={setMuscle} />
            ))}
          </div>
        </section>
      ) : (
        <section ref={gridTopRef}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-black uppercase tracking-wide text-text-secondary transition-colors hover:bg-muted/70"
            >
              <Icon name="ArrowLeft" size={14} />
              Grupos
            </button>
            <p className="text-xs font-bold text-text-tertiary">
              {activeContextLabel ? <span className="text-text-secondary">{activeContextLabel} · </span> : null}
              {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
            </p>
          </div>

          {results.length === 0 ? (
            <EmptyState
              iconName="SearchX"
              title="Sin resultados"
              description="Probá con otro término o limpiá los filtros."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {results.slice(0, visible).map((ex) => (
                  <ExerciseGridCard
                    key={ex.id || ex.slug || ex.name}
                    exercise={ex}
                    onSelect={setSelected}
                  />
                ))}
              </div>
              {visible < results.length ? (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-black text-text-primary transition-colors hover:border-primary/30 hover:text-primary"
                  >
                    <Icon name="Plus" size={16} />
                    Cargar más ({results.length - visible})
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      )}

      <ExerciseDetailModal exercise={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </div>
  );
};

export default ExerciseBrowser;
