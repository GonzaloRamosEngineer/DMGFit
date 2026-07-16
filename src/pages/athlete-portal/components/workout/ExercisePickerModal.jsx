import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import Icon from '../../../../components/AppIcon';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { fetchExercises, getExerciseFacets } from '../../../../services/exercises';

const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const PickerRow = ({ exercise, selected, onToggle, onInfo }) => (
  <div
    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${
      selected ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-muted/60'
    }`}
    onClick={() => onToggle(exercise)}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(exercise); } }}
  >
    <span className={`h-9 w-1 shrink-0 rounded-full transition-colors ${selected ? 'bg-primary' : 'bg-transparent'}`} />
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-white">
      {exercise.image_url ? (
        <img src={exercise.image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-text-tertiary">
          <Icon name="Dumbbell" size={18} />
        </div>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-text-primary">{exercise.name}</p>
      <p className="truncate text-xs font-semibold text-text-tertiary">
        {exercise.primary_muscle || exercise.muscle_group || '—'}
      </p>
    </div>
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onInfo(exercise); }}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-muted hover:text-primary"
      aria-label={`Ver detalle de ${exercise.name}`}
    >
      <Icon name="Info" size={17} />
    </button>
  </div>
);

const FilterSelect = ({ value, onChange, options, allLabel }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-muted px-3 text-xs font-black uppercase tracking-wide text-text-secondary outline-none transition-colors focus:border-primary"
  >
    <option value="all">{allLabel}</option>
    {options.map((o) => (
      <option key={o} value={o}>{o}</option>
    ))}
  </select>
);

/**
 * Selector de ejercicios para el entrenamiento en curso (estilo Hevy):
 * búsqueda + filtros por equipo/músculo + "Recientes" + multi-selección.
 */
const ExercisePickerModal = ({ open, onClose, onAdd, onInfo, recentIds = [], excludeIds = [] }) => {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [equipment, setEquipment] = useState('all');
  const [muscle, setMuscle] = useState('all');
  const [selected, setSelected] = useState(new Map());

  useEffect(() => {
    if (!open) return;
    setSelected(new Map());
    setSearch('');
    if (all.length) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchExercises({ limit: 1000 });
        if (mounted) setAll(data);
      } catch (e) {
        console.error('Error cargando ejercicios:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const facets = useMemo(() => getExerciseFacets(all), [all]);
  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return all.filter((ex) => {
      if (excluded.has(ex.id)) return false;
      const m = ex.primary_muscle || ex.muscle_group || '';
      if (muscle !== 'all' && m !== muscle) return false;
      if (equipment !== 'all' && ex.equipment !== equipment) return false;
      if (!term) return true;
      const hay = normalize([ex.name, m, ex.equipment, (ex.aliases || []).join(' ')].filter(Boolean).join(' '));
      return hay.includes(term);
    });
  }, [all, search, equipment, muscle, excluded]);

  const recents = useMemo(() => {
    if (search.trim() || equipment !== 'all' || muscle !== 'all') return [];
    const pos = new Map(recentIds.map((id, i) => [id, i]));
    return filtered
      .filter((ex) => pos.has(ex.id))
      .sort((a, b) => pos.get(a.id) - pos.get(b.id))
      .slice(0, 6);
  }, [filtered, recentIds, search, equipment, muscle]);

  const rest = useMemo(() => {
    const recentSet = new Set(recents.map((r) => r.id));
    return filtered.filter((ex) => !recentSet.has(ex.id));
  }, [filtered, recents]);

  const toggle = (exercise) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(exercise.id)) next.delete(exercise.id);
      else next.set(exercise.id, exercise);
      return next;
    });
  };

  const confirm = () => {
    if (!selected.size) return;
    onAdd([...selected.values()]);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Agregar ejercicio" size="lg">
      <div className="flex max-h-[70vh] flex-col gap-3">
        <div className="relative shrink-0">
          <Icon name="Search" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ejercicio…"
            className="h-11 w-full rounded-xl border border-border bg-muted pl-10 pr-4 text-sm font-semibold text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-primary"
          />
        </div>

        <div className="flex shrink-0 gap-2">
          <FilterSelect value={equipment} onChange={setEquipment} options={facets.equipment} allLabel="Todo equipamiento" />
          <FilterSelect value={muscle} onChange={setMuscle} options={facets.muscles} allLabel="Todos los músculos" />
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
            ))
          ) : (
            <>
              {recents.length ? (
                <>
                  <p className="px-1 pb-1 pt-2 text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                    Recientes
                  </p>
                  {recents.map((ex) => (
                    <PickerRow key={ex.id} exercise={ex} selected={selected.has(ex.id)} onToggle={toggle} onInfo={onInfo} />
                  ))}
                  <p className="px-1 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                    Todos
                  </p>
                </>
              ) : null}
              {rest.map((ex) => (
                <PickerRow key={ex.id} exercise={ex} selected={selected.has(ex.id)} onToggle={toggle} onInfo={onInfo} />
              ))}
              {!rest.length && !recents.length ? (
                <EmptyState iconName="SearchX" title="Sin resultados" description="Probá con otro término o limpiá los filtros." />
              ) : null}
            </>
          )}
        </div>

        {selected.size > 0 ? (
          <div className="shrink-0 pt-1">
            <button
              type="button"
              onClick={confirm}
              className="h-12 w-full rounded-2xl bg-primary text-sm font-black text-white shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              Agregar {selected.size} {selected.size === 1 ? 'ejercicio' : 'ejercicios'}
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default ExercisePickerModal;
