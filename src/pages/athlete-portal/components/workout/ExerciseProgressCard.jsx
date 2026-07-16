import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../../components/AppIcon';
import Modal from '../../../../components/ui/Modal';
import { fetchStrengthProgress } from '../../../../services/workouts';
import ExerciseTrendChart from './ExerciseTrendChart';
import { formatearFecha } from '../../../../utils/formatters';

const METRICS = [
  { key: 'bestLoad', label: 'Mayor peso', unit: 'kg' },
  { key: 'best1rm', label: '1RM estimado', unit: 'kg' },
  { key: 'volume', label: 'Volumen', unit: 'kg' },
];

const MetricChip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-black transition-colors ${
      active ? 'bg-primary text-white' : 'bg-muted text-text-secondary hover:bg-muted/70'
    }`}
  >
    {children}
  </button>
);

/** Hoja para elegir entre los ejercicios que el atleta ya entrenó. */
const TrainedExerciseSheet = ({ open, onClose, groups, selectedId, onSelect }) => (
  <Modal open={open} onClose={onClose} title="Elegir ejercicio" size="sm">
    <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
      {groups.map((g) => {
        const active = g.exercise.id === selectedId;
        return (
          <button
            key={g.exercise.id}
            type="button"
            onClick={() => { onSelect(g.exercise.id); onClose(); }}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
              active ? 'bg-primary/10' : 'hover:bg-muted'
            }`}
          >
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-white">
              {g.exercise.image_url ? (
                <img src={g.exercise.image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-text-tertiary">
                  <Icon name="Dumbbell" size={15} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-bold ${active ? 'text-primary' : 'text-text-primary'}`}>
                {g.exercise.name}
              </p>
              <p className="truncate text-xs font-semibold text-text-tertiary">
                {g.points.length} {g.points.length === 1 ? 'sesión' : 'sesiones'}
              </p>
            </div>
            {active ? <Icon name="Check" size={17} className="shrink-0 text-primary" /> : null}
          </button>
        );
      })}
    </div>
  </Modal>
);

/**
 * "Progreso por ejercicio": curva de mejor serie / 1RM estimado / volumen por
 * sesión, derivada de los entrenamientos registrados (workout_results).
 */
const ExerciseProgressCard = ({ athleteId }) => {
  const [groups, setGroups] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [metric, setMetric] = useState('bestLoad');
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!athleteId) return;
    let mounted = true;
    fetchStrengthProgress(athleteId)
      .then((data) => {
        if (!mounted) return;
        setGroups(data);
        if (data.length) setSelectedId((prev) => prev ?? data[0].exercise.id);
      })
      .catch((e) => { console.error('Error cargando progreso de fuerza:', e); if (mounted) setGroups([]); });
    return () => { mounted = false; };
  }, [athleteId]);

  const group = useMemo(
    () => (groups ?? []).find((g) => g.exercise.id === selectedId) ?? null,
    [groups, selectedId]
  );

  const activeMetric = METRICS.find((m) => m.key === metric) ?? METRICS[0];
  const points = useMemo(
    () => (group?.points ?? []).map((p) => ({ date: p.date, value: Math.round(p[metric] * 10) / 10 })),
    [group, metric]
  );
  const latest = points.length ? points[points.length - 1] : null;
  const best = points.length ? points.reduce((a, b) => (b.value > a.value ? b : a)) : null;

  if (groups === null) {
    return <div className="h-64 animate-pulse rounded-3xl bg-muted" />;
  }

  if (!groups.length) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-10 text-center">
        <Icon name="TrendingUp" size={30} className="mx-auto mb-2 text-text-tertiary" />
        <p className="text-sm font-black text-text-primary">Tu progreso aparece acá</p>
        <p className="mx-auto mt-1 max-w-sm text-xs font-medium leading-relaxed text-text-secondary">
          Registrá entrenamientos en la pestaña Entrenar y vas a ver la evolución de cada ejercicio: mayor peso, 1RM estimado y volumen por sesión.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-tertiary">
              Fuerza · desde tus entrenamientos
            </p>
            <h3 className="truncate text-lg font-black text-text-primary">Progreso por ejercicio</h3>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex max-w-[45%] shrink-0 items-center gap-2 rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-black text-text-primary transition-colors hover:border-primary/30"
          >
            <span className="truncate">{group?.exercise.name ?? 'Elegir'}</span>
            <Icon name="ChevronDown" size={14} className="shrink-0 text-text-tertiary" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {METRICS.map((m) => (
            <MetricChip key={m.key} active={metric === m.key} onClick={() => setMetric(m.key)}>
              {m.label}
            </MetricChip>
          ))}
        </div>
      </div>

      <div className="px-5 py-4">
        {latest ? (
          <div className="mb-2 flex items-baseline gap-2">
            <p className="text-2xl font-black tabular-nums text-text-primary">
              {latest.value.toLocaleString('es-AR')} {activeMetric.unit}
            </p>
            <p className="text-xs font-bold text-text-tertiary">{formatearFecha(latest.date)}</p>
            {best && best.value > latest.value ? (
              <p className="ml-auto text-xs font-bold text-text-tertiary">
                Récord: <span className="text-text-secondary">{best.value.toLocaleString('es-AR')} {activeMetric.unit}</span>
              </p>
            ) : (
              <p className="ml-auto flex items-center gap-1 text-xs font-black text-success">
                <Icon name="Trophy" size={13} />
                Récord personal
              </p>
            )}
          </div>
        ) : null}

        {points.length >= 2 ? (
          <ExerciseTrendChart points={points} unit={activeMetric.unit} gradientId="progressCardTrend" />
        ) : (
          <p className="rounded-2xl bg-muted px-4 py-6 text-center text-xs font-semibold text-text-tertiary">
            Con una sesión más de este ejercicio ya se dibuja la curva de progreso.
          </p>
        )}
      </div>

      <TrainedExerciseSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        groups={groups}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
  );
};

export default ExerciseProgressCard;
