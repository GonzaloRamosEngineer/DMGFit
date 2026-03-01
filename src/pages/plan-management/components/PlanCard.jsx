import React, { useMemo } from 'react';
import Icon from '../../../components/AppIcon';

const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getLowestPrice = (plan) => {
  const tiers = Array.isArray(plan?.pricingTiers) ? plan.pricingTiers : [];
  const validPrices = tiers
    .map((tier) => Number(tier?.price || 0))
    .filter((price) => Number.isFinite(price) && price >= 0);

  if (validPrices.length > 0) return Math.min(...validPrices);
  return Number(plan?.price || 0);
};

const timeToMinutes = (value = '') => {
  const [hh = '0', mm = '0'] = String(value).slice(0, 5).split(':');
  return Number(hh) * 60 + Number(mm);
};

const splitConsecutiveRanges = (days = []) => {
  const uniqueSorted = [...new Set(days.map(Number).filter((d) => d >= 0 && d <= 6))].sort(
    (a, b) => a - b
  );

  if (uniqueSorted.length === 0) return [];

  const ranges = [];
  let start = uniqueSorted[0];
  let prev = uniqueSorted[0];

  for (let i = 1; i < uniqueSorted.length; i += 1) {
    const day = uniqueSorted[i];
    if (day === prev + 1) {
      prev = day;
      continue;
    }

    ranges.push([start, prev]);
    start = day;
    prev = day;
  }

  ranges.push([start, prev]);
  return ranges;
};

const formatDayRange = ([start, end]) => {
  if (start === end) return DAYS_SHORT[start] || 'Día';
  if (end === start + 1) return `${DAYS_SHORT[start]} y ${DAYS_SHORT[end]}`;
  return `${DAYS_SHORT[start]} a ${DAYS_SHORT[end]}`;
};

const joinLabelsHumanly = (labels = []) => {
  if (labels.length <= 1) return labels[0] || '';
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
};

const formatDayGroup = (days = []) => {
  const ranges = splitConsecutiveRanges(days).map(formatDayRange);
  return joinLabelsHumanly(ranges);
};

const getSummaryIconName = (startTime = '') => {
  const hour = Number(String(startTime).slice(0, 2) || 0);

  if (hour < 12) return 'Sun';
  if (hour < 18) return 'Clock3';
  return 'Moon';
};

const getAvailabilitySummary = (plan) => {
  const windows = Array.isArray(plan?.availabilityWindows) ? plan.availabilityWindows : [];

  if (windows.length > 0) {
    const groups = new Map();

    windows.forEach((window) => {
      const start = String(window.start_time || '').slice(0, 5);
      const end = String(window.end_time || '').slice(0, 5);
      const day = Number(window.day_of_week);

      if (!start || !end || !Number.isInteger(day)) return;

      const key = `${start}-${end}`;

      if (!groups.has(key)) {
        groups.set(key, {
          start,
          end,
          days: [],
        });
      }

      groups.get(key).days.push(day);
    });

    const groupedItems = Array.from(groups.values())
      .map((group) => ({
        startTime: group.start,
        label: `${formatDayGroup(group.days)} · ${group.start} a ${group.end} hs`,
        sortDay: Math.min(...group.days),
        sortTime: timeToMinutes(group.start),
      }))
      .sort((a, b) => {
        if (a.sortDay !== b.sortDay) return a.sortDay - b.sortDay;
        return a.sortTime - b.sortTime;
      });

    return {
      items: groupedItems.slice(0, 3),
      extraCount: Math.max(groupedItems.length - 3, 0),
    };
  }

  const schedule = Array.isArray(plan?.schedule) ? plan.schedule : [];
  const fallbackItems = schedule.slice(0, 3).map((slot) => {
    const startTime =
      String(slot.start_time || '').slice(0, 5) ||
      String(slot.time || '').slice(0, 5);

    return {
      label: `${slot.day || 'Día'}: ${slot.time || ''}`,
      startTime,
    };
  });

  return {
    items: fallbackItems,
    extraCount: Math.max(schedule.length - 3, 0),
  };
};

const getAccumulatedAvailability = (plan) => {
  const schedule = Array.isArray(plan?.schedule) ? plan.schedule : [];

  let hasRemainingData = false;

  const totalRemaining = schedule.reduce((sum, slot) => {
    const rawRemaining = slot?.remaining;

    if (rawRemaining === undefined || rawRemaining === null || Number.isNaN(Number(rawRemaining))) {
      return sum;
    }

    hasRemainingData = true;
    return sum + Math.max(0, Number(rawRemaining));
  }, 0);

  const slotCount = schedule.filter((slot) =>
    Number.isFinite(Number(slot?.capacity))
  ).length;

  return {
    totalRemaining,
    slotCount,
    hasRemainingData,
  };
};

const PlanCard = ({
  plan,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewGrid,
  loading = false,
}) => {
  const lowestPrice = useMemo(() => getLowestPrice(plan), [plan]);
  const availabilitySummary = useMemo(() => getAvailabilitySummary(plan), [plan]);
  const accumulatedAvailability = useMemo(
    () => getAccumulatedAvailability(plan),
    [plan]
  );

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden animate-pulse flex flex-col h-full">
        <div className="bg-slate-950 px-6 py-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="space-y-3 flex-1">
              <div className="h-8 w-48 bg-slate-800 rounded-lg" />
              <div className="h-4 w-72 bg-slate-800 rounded-lg" />
            </div>
            <div className="h-8 w-20 bg-slate-800 rounded-full" />
          </div>
        </div>

        <div className="p-6 flex-1 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 rounded-2xl bg-slate-100" />
            <div className="h-24 rounded-2xl bg-slate-100" />
          </div>

          <div className="h-40 rounded-2xl bg-slate-50 border border-slate-100" />
        </div>

        <div className="px-6 py-5 border-t border-slate-100 bg-slate-50">
          <div className="flex justify-end gap-6">
            <div className="h-5 w-16 bg-slate-200 rounded" />
            <div className="h-5 w-20 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const enrolled = Number(plan?.enrolled || 0);
  const isActive = plan?.status === 'active';

  return (
    <div
      className={`bg-white border rounded-[2rem] overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 flex flex-col h-full ${
        isActive ? 'border-slate-200' : 'border-slate-200 opacity-95'
      }`}
    >
      {/* Header oscuro */}
      <div className="bg-gradient-to-r from-slate-950 to-slate-900 px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-2xl font-black text-white uppercase tracking-wide truncate">
              {plan?.name || 'Plan'}
            </h3>
            <p className="text-sm text-slate-300 mt-2 line-clamp-2 min-h-[40px]">
              {plan?.description || 'Sin descripción disponible.'}
            </p>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-black border flex-shrink-0 inline-flex items-center gap-2 ${
              isActive
                ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isActive ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            {isActive ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="p-6 flex-1 flex flex-col">
        {/* Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">
              Precios desde
            </p>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-black text-slate-900">
                {formatCurrency(lowestPrice)}
              </span>
              <span className="text-sm font-bold text-slate-400 mb-1">/mes</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Varía según frecuencia semanal
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">
              Ocupación actual
            </p>

            <div className="flex items-end gap-1">
              <span className="text-3xl font-black text-slate-900">{enrolled}</span>
              <span className="text-sm font-bold text-slate-400 mb-1">alumnos</span>
            </div>

            {accumulatedAvailability.hasRemainingData ? (
              <>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-xl font-black text-emerald-600">
                    {accumulatedAvailability.totalRemaining}
                  </span>
                  <span className="text-sm font-bold text-slate-400 mb-0.5">
                    lugares libres
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Disponibilidad horaria acumulada
                </p>

                {accumulatedAvailability.slotCount > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Sumatoria de libres reales en {accumulatedAvailability.slotCount} slots configurados
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400 mt-3">
                Disponibilidad horaria no calculada
              </p>
            )}
          </div>
        </div>

        {/* Horarios habilitados */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex-1">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">
            Horarios habilitados
          </p>

          <div className="space-y-2 mb-3">
            {availabilitySummary.items.length > 0 ? (
              availabilitySummary.items.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-slate-700">
                  <Icon
                    name={getSummaryIconName(item.startTime)}
                    size={14}
                    className="text-slate-400"
                  />
                  <span className="font-medium">{item.label}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 italic">Sin horarios definidos</p>
            )}
          </div>

          <div className="mb-4">
            <p className="text-xs text-slate-400">
              Resumen de disponibilidad semanal del plan
            </p>

            {availabilitySummary.extraCount > 0 && (
              <p className="text-[11px] font-semibold text-slate-400 mt-1">
                +{availabilitySummary.extraCount} franja{availabilitySummary.extraCount > 1 ? 's' : ''} más
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onViewGrid?.(plan)}
            className="w-full rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 text-slate-900 py-3 font-black uppercase tracking-wide text-sm transition-colors inline-flex items-center justify-center gap-2"
          >
            <span>🔍</span>
            Ver grilla de cupos
          </button>
        </div>
      </div>

      {/* Footer acciones */}
      <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-8">
        <button
          type="button"
          onClick={() => onEdit?.(plan)}
          className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-900 transition-colors"
        >
          <Icon name="Pencil" size={14} className="text-orange-500" />
          Editar
        </button>

        <button
          type="button"
          onClick={() => onToggleStatus?.(plan.id)}
          className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-900 transition-colors"
        >
          <Icon
            name={isActive ? 'CircleOff' : 'Eye'}
            size={14}
            className={isActive ? 'text-rose-500' : 'text-emerald-500'}
          />
          {isActive ? 'Dar de baja' : 'Activar'}
        </button>

        <button
          type="button"
          onClick={() => onDelete?.(plan.id)}
          className="inline-flex items-center gap-2 text-sm font-black text-slate-400 hover:text-rose-600 transition-colors"
          title="Eliminar plan"
        >
          <Icon name="Trash2" size={14} />
        </button>
      </div>
    </div>
  );
};

export default PlanCard;