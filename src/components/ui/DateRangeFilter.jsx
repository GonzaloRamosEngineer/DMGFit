import React from 'react';
import Icon from '../AppIcon';
import Button from './Button';

// Filtro de rango de fechas unificado y premium.
// Fuente de verdad para "Historial de Accesos", "Asistencia de Profesores"
// y "Caja y Cobros": misma anatomía en todas las pantallas.
//
// Anatomía: card blanca con dos filas.
//  - Fila 1: chip calendario + campos Desde → Hasta (+ segmentos extra vía children)
//  - Fila 2: chips de rango rápido (Hoy / 7 / 30 / 90 días) + botón Buscar opcional
//
// Los inputs de fecha nativos se "des-chrome-ean" (appearance-none) para que
// iOS no dibuje su caja con borde; el tap sigue abriendo el picker del sistema.

const PRESETS = [
  { key: 'hoy', label: 'Hoy', days: 0 },
  { key: '7d', label: '7 días', days: 6 },
  { key: '30d', label: '30 días', days: 29 },
  { key: '90d', label: '90 días', days: 89 },
];

const localISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const rangeForDays = (days) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return { start: localISO(start), end: localISO(end) };
};

// border-0/p-0/bg-none/focus:ring-0 anulan los estilos base de @tailwindcss/forms
// (caja con borde, padding y flecha propia) para que quede como texto tocable.
const DATE_INPUT_CLS =
  'w-full min-w-0 appearance-none border-0 p-0 bg-transparent focus:ring-0 text-sm font-black text-text-primary outline-none cursor-pointer ' +
  '[&::-webkit-date-and-time-value]:text-left';

// Segmento con label chico arriba y control abajo. Exportado para que las
// páginas puedan sumar controles propios (ej. select de Profesor) con el
// mismo look que Desde/Hasta.
export const FilterSegment = ({ label, className = '', children }) => (
  <label className={`flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 rounded-xl px-3 py-1.5 transition-colors hover:bg-muted ${className}`}>
    <span className="text-[9px] font-black uppercase tracking-widest text-text-tertiary">
      {label}
    </span>
    {children}
  </label>
);

const PresetChip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors ${
      active
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'bg-muted text-text-secondary hover:bg-info-light hover:text-primary'
    }`}
  >
    {children}
  </button>
);

const DateRangeFilter = ({
  start,
  end,
  onStartChange,
  onEndChange,
  onRangeSelect,     // ({start, end}) => void — habilita los chips de rango rápido
  onSearch,          // si se pasa, muestra el botón "Buscar"; si no, se asume filtrado en vivo
  loading = false,
  allowClear = false, // agrega el chip "Todo" (rango vacío = sin filtro)
  children,          // segmentos extra (ej. <FilterSegment label="Profesor">…)
  className = '',
}) => {
  const isPresetActive = (days) => {
    const r = rangeForDays(days);
    return start === r.start && end === r.end;
  };

  return (
    <div className={`w-full rounded-2xl border border-border bg-card p-2 shadow-sm lg:w-auto ${className}`}>
      {/* Fila 1: campos */}
      <div className="flex flex-wrap items-center gap-1">
        <div className="ml-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info-light text-primary sm:flex">
          <Icon name="CalendarRange" size={17} />
        </div>

        <FilterSegment label="Desde" className="min-w-[130px]">
          <input type="date" value={start || ''} onChange={onStartChange} className={DATE_INPUT_CLS} />
        </FilterSegment>

        <Icon name="ArrowRight" size={14} className="shrink-0 text-text-tertiary" />

        <FilterSegment label="Hasta" className="min-w-[130px]">
          <input type="date" value={end || ''} onChange={onEndChange} className={DATE_INPUT_CLS} />
        </FilterSegment>

        {children}
      </div>

      {/* Fila 2: rangos rápidos + acción */}
      {(onRangeSelect || onSearch) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-border/60 px-1 pb-0.5 pt-2">
          {onRangeSelect && allowClear && (
            <PresetChip active={!start && !end} onClick={() => onRangeSelect({ start: '', end: '' })}>
              Todo
            </PresetChip>
          )}

          {onRangeSelect && PRESETS.map((p) => (
            <PresetChip key={p.key} active={isPresetActive(p.days)} onClick={() => onRangeSelect(rangeForDays(p.days))}>
              {p.label}
            </PresetChip>
          ))}

          {onSearch && (
            <Button
              onClick={() => onSearch()}
              disabled={loading}
              loading={loading}
              iconName="Search"
              size="sm"
              className="ml-auto h-9 rounded-xl px-4 text-xs uppercase tracking-wider shadow-sm"
            >
              Buscar
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
