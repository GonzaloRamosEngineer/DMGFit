import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';
import { hoyLocal } from '../../../utils/formatters';

// --- UTILS & STYLES ---

const INPUT_STYLE = "w-full bg-muted border border-border text-text-primary text-sm font-bold rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent block p-4 transition-all outline-none placeholder:text-text-tertiary";
const LABEL_STYLE = "block mb-2 text-[10px] font-black text-text-tertiary uppercase tracking-[0.2em]";

// Métricas "Favoritas" para acceso rápido (Chips)
const QUICK_METRICS = ['Peso Corporal', 'Grasa Corporal', 'Sentadilla', 'Press Banca'];

const cx = (...classes) => classes.filter(Boolean).join(' ');

const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const inferUnitFromExercise = (exercise) => {
  switch (exercise?.tracking_type) {
    case 'reps':
      return 'reps';
    case 'time':
      return 'min';
    case 'distance':
    case 'time_distance':
      return 'km';
    case 'bodyweight':
    case 'assisted_bodyweight':
    case 'reps_weight':
    default:
      return 'kg';
  }
};

const MetricPicker = ({ value, unit, options, onSelect, compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const pickerRef = useRef(null);
  const searchInputRef = useRef(null);

  const filteredOptions = useMemo(() => {
    const term = normalize(query.trim());
    return options
      .filter((option) => !term || normalize(`${option.name} ${option.category || ''}`).includes(term))
      .slice(0, 8);
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (pickerRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [isOpen]);

  const handleSelect = (metricName) => {
    onSelect(metricName);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={pickerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={cx(
          "group flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-muted text-left text-text-primary transition-all hover:border-primary/30 hover:bg-card focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15",
          compact ? "min-h-[52px] px-4 py-3" : "min-h-[64px] px-5 py-4"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-black">{value || 'Elegir métrica'}</span>
          <span className="mt-0.5 block text-[10px] font-black uppercase tracking-widest text-text-tertiary">
            {unit ? `Unidad · ${unit}` : 'Selección requerida'}
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-text-secondary transition-colors group-hover:text-primary">
          <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={18} />
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_70px_-28px_rgba(15,23,42,0.35)]"
          role="listbox"
        >
          <div className="border-b border-border p-3">
            <div className="relative">
              <Icon
                name="Search"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar métrica..."
                className="h-10 w-full rounded-xl border border-border bg-muted pl-9 pr-3 text-sm font-bold text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary focus:bg-card"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs font-bold text-text-tertiary">
                Sin resultados
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.name === value;
                return (
                  <button
                    key={option.id || option.name}
                    type="button"
                    onClick={() => handleSelect(option.name)}
                    className={cx(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      isSelected ? "bg-primary/10 text-primary" : "text-text-primary hover:bg-muted"
                    )}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{option.name}</span>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                        {option.category || 'Métrica'} · {option.unit || '-'}
                      </span>
                    </span>
                    {isSelected ? (
                      <Icon name="CheckCircle2" size={18} className="shrink-0 text-primary" />
                    ) : (
                      <Icon name="Plus" size={16} className="shrink-0 text-text-tertiary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function MetricEntryForm({ athleteId, onSuccess, selectedExercise, embedded = false, compact = false }) {
  // Estado del Formulario
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    value: '',
    date: hoyLocal()
  });

  // Estado del Catálogo y UI
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'submitting' | 'success' | 'error'
  const formRef = useRef(null);

  const metricOptions = useMemo(() => {
    if (!selectedExercise?.name) return catalog;

    const exists = catalog.some((item) => item.name === selectedExercise.name);
    if (exists) return catalog;

    return [
      {
        id: `exercise-${selectedExercise.id || selectedExercise.slug || selectedExercise.name}`,
        name: selectedExercise.name,
        unit: inferUnitFromExercise(selectedExercise),
      },
      ...catalog,
    ];
  }, [catalog, selectedExercise]);

  // 1. CARGAR CATÁLOGO
  useEffect(() => {
    const fetchCatalog = async () => {
      setStatus('loading');
      try {
        const { data, error } = await supabase
          .from('metrics_catalog')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;

        setCatalog(data || []);
        
        // Pre-seleccionar default
        if (data && data.length > 0) {
           selectMetricByName('Peso Corporal', data);
        }
        setStatus('idle');
      } catch (err) {
        console.error("Error catálogo:", err);
        setStatus('error');
      }
    };

    fetchCatalog();
  }, []);

  useEffect(() => {
    if (!selectedExercise?.name) return;

    setFormData(prev => ({
      ...prev,
      name: selectedExercise.name,
      unit: inferUnitFromExercise(selectedExercise)
    }));
  }, [selectedExercise]);

  // Helper para seleccionar métrica y autocompletar unidad
  const selectMetricByName = (name, currentCatalog = metricOptions) => {
    const metric = currentCatalog.find(m => m.name === name) || currentCatalog[0];
    if (metric) {
      setFormData(prev => ({
        ...prev,
        name: metric.name,
        unit: metric.unit
      }));
    }
  };

  // 2. HANDLERS
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleQuickClick = (metricName) => {
    selectMetricByName(metricName);
    // Opcional: Enfocar el input de valor automáticamente
    // document.getElementById('value-input')?.focus(); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!athleteId || !formData.value) return;

    setStatus('submitting');

    try {
      const { error } = await supabase
        .from('performance_metrics')
        .insert([{
          athlete_id: athleteId,
          name: formData.name,
          value: formData.value,
          unit: formData.unit,
          metric_date: formData.date
        }]);

      if (error) throw error;

      // Éxito con Animación
      setStatus('success');
      setFormData(prev => ({ ...prev, value: '' })); // Limpiar valor
      
      if (onSuccess) onSuccess();

      // Resetear estado visual después de 2s
      setTimeout(() => setStatus('idle'), 2000);

    } catch (err) {
      console.error(err);
      setStatus('error'); // Podrías manejar un error específico
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <div className={cx(
      "relative overflow-hidden",
      embedded
        ? "min-w-0"
        : "bg-card rounded-3xl p-6 md:p-8 border border-border shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)]"
    )}>

      {/* Header */}
      <div className={cx("relative", compact ? "mb-4" : "mb-6")}>
        {selectedExercise && (
          <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-black text-primary">
            <Icon name="Dumbbell" size={14} />
            <span className="truncate">{selectedExercise.name}</span>
          </div>
        )}
        <h3 className={cx("font-black text-text-primary flex items-center gap-3", compact ? "text-lg" : "text-xl")}>
          <div className={cx("bg-primary rounded-xl text-primary-foreground shadow-md", compact ? "p-2" : "p-2.5")}>
            <Icon name="Plus" size={compact ? 18 : 20} strokeWidth={3} />
          </div>
          Registrar <span className="text-primary">Progreso</span>
        </h3>
      </div>

      <form onSubmit={handleSubmit} ref={formRef} className={cx("flex flex-col relative z-10", compact ? "gap-4" : "gap-6")}>
        
        {/* Quick Chips (Accesos Rápidos) */}
        <div>
           <label className={LABEL_STYLE}>Accesos Rápidos</label>
           <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
              {QUICK_METRICS.map(m => (
                 <button
                    type="button"
                    key={m}
                    onClick={() => handleQuickClick(m)}
                    className={`whitespace-nowrap rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border ${compact ? 'px-3 py-1.5' : 'px-4 py-2'} ${
                       formData.name === m
                       ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                       : 'bg-card border-border text-text-secondary hover:border-primary/40 hover:text-primary'
                    }`}
                 >
                    {m}
                 </button>
              ))}
           </div>
        </div>

        {/* Inputs Principales */}
        <div className={cx("grid grid-cols-1 md:grid-cols-2", compact ? "gap-3" : "gap-5")}>
           
           {/* Selector de Métrica */}
           <div className="relative group">
              <label className={LABEL_STYLE}>Métrica</label>
              <MetricPicker
                value={formData.name}
                unit={formData.unit}
                options={metricOptions}
                onSelect={selectMetricByName}
                compact={compact}
              />
           </div>

           {/* Input de Valor con Unidad Integrada */}
           <div>
              <label className={LABEL_STYLE}>Nuevo Valor</label>
              <div className="relative group">
                 <input 
                    id="value-input"
                    type="number" 
                    step="0.01" 
                    name="value" 
                    value={formData.value} 
                    onChange={handleChange}
                    placeholder="0.00"
                    className={`${INPUT_STYLE} ${compact ? 'p-3 text-lg' : 'text-xl'} pr-16`}
                    autoComplete="off"
                 />
                 <div className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-muted rounded-lg">
                    <span className="text-[10px] font-black text-text-secondary">
                       {formData.unit || '-'}
                    </span>
                 </div>
              </div>
           </div>
        </div>

        {/* Footer: Fecha y Botón de Acción */}
        <div className={cx("flex items-end", compact ? "gap-3 mt-0" : "gap-5 mt-2")}>
           <div className="w-1/3 min-w-[130px]">
              <label className={LABEL_STYLE}>Fecha</label>
              <input 
                 type="date" 
                 name="date" 
                 value={formData.date} 
                 onChange={handleChange}
                 className={`${INPUT_STYLE} ${compact ? 'p-3' : 'py-3'}`}
              />
           </div>

           <div className="flex-1">
              <button 
                 type="submit" 
                 disabled={status === 'submitting' || status === 'loading' || !formData.value}
                 className={`w-full ${compact ? 'h-[48px]' : 'h-[52px]'} rounded-xl font-bold uppercase tracking-widest text-xs transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${
                    status === 'success'
                       ? 'bg-success text-success-foreground shadow-md hover:bg-success/90'
                       : status === 'error'
                          ? 'bg-error text-error-foreground shadow-md'
                          : 'bg-primary text-primary-foreground shadow-md hover:bg-slate-900 hover:shadow-slate-300'
                 } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                 {status === 'loading' && <span>Cargando...</span>}
                 {status === 'submitting' && (
                    <>
                       <Icon name="Loader" className="animate-spin" size={16} />
                       <span>Guardando...</span>
                    </>
                 )}
                 {status === 'success' && (
                    <>
                       <Icon name="Check" size={18} strokeWidth={4} />
                       <span>¡Registrado!</span>
                    </>
                 )}
                 {status === 'error' && <span>Error al guardar</span>}
                 {status === 'idle' && (
                    <>
                       <span>Guardar Registro</span>
                       <Icon name="ArrowRight" size={16} />
                    </>
                 )}
              </button>
           </div>
        </div>

      </form>
    </div>
  );
}
