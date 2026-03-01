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

const getAvailabilitySummary = (plan) => {
  const windows = Array.isArray(plan?.availabilityWindows) ? plan.availabilityWindows : [];

  if (windows.length > 0) {
    return windows
      .slice()
      .sort((a, b) => {
        if (Number(a.day_of_week) !== Number(b.day_of_week)) {
          return Number(a.day_of_week) - Number(b.day_of_week);
        }
        return String(a.start_time || '').localeCompare(String(b.start_time || ''));
      })
      .slice(0, 3)
      .map((window) => ({
        label: `${DAYS_SHORT[Number(window.day_of_week)] || 'Día'}: ${String(
          window.start_time || ''
        ).slice(0, 5)} a ${String(window.end_time || '').slice(0, 5)} hs`,
      }));
  }

  const schedule = Array.isArray(plan?.schedule) ? plan.schedule : [];
  return schedule.slice(0, 3).map((slot) => ({
    label: `${slot.day || 'Día'}: ${slot.time || ''}`,
  }));
};

const getProgressColor = (occupancyRate) => {
  if (occupancyRate >= 100) return 'bg-rose-500';
  if (occupancyRate >= 80) return 'bg-amber-400';
  return 'bg-emerald-500';
};

const getProgressTrackTextColor = (occupancyRate) => {
  if (occupancyRate >= 100) return 'text-rose-600';
  if (occupancyRate >= 80) return 'text-amber-600';
  return 'text-emerald-600';
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
  const capacity = Math.max(0, Number(plan?.capacity || 0));
  const occupancyRate = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
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
              Ocupación
            </p>

            <div className="flex items-end gap-1">
              <span className="text-3xl font-black text-slate-900">{enrolled}</span>
              <span className="text-sm font-bold text-slate-400 mb-1">alumnos</span>
            </div>

            <div className="mt-3">
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${getProgressColor(occupancyRate)}`}
                  style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                />
              </div>
              <p
                className={`text-xs font-black mt-2 ${getProgressTrackTextColor(
                  occupancyRate
                )}`}
              >
                {occupancyRate}% de ocupación
              </p>
            </div>
          </div>
        </div>

        {/* Ventanas horarias */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex-1">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">
            Ventanas horarias
          </p>

          <div className="space-y-2 mb-4">
            {availabilitySummary.length > 0 ? (
              availabilitySummary.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-slate-700">
                  <Icon
                    name={index === 0 ? 'Sun' : index === 1 ? 'Moon' : 'Clock3'}
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