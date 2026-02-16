import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';

// --- UTILS & STYLES ---

const INPUT_STYLE = "w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent block p-4 transition-all outline-none placeholder:text-slate-300";
const LABEL_STYLE = "block mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]";

// Métricas "Favoritas" para acceso rápido (Chips)
const QUICK_METRICS = ['Peso Corporal', 'Grasa Corporal', 'Sentadilla', 'Press Banca'];

export default function MetricEntryForm({ athleteId, onSuccess }) {
  // Estado del Formulario
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    value: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Estado del Catálogo y UI
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'submitting' | 'success' | 'error'
  const formRef = useRef(null);

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

  // Helper para seleccionar métrica y autocompletar unidad
  const selectMetricByName = (name, currentCatalog = catalog) => {
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
    if (name === 'name') {
       selectMetricByName(value);
    } else {
       setFormData(prev => ({ ...prev, [name]: value }));
    }
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
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden">
      
      {/* Background Decorativo */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50/50 rounded-bl-[100px] -mr-10 -mt-10 pointer-events-none"></div>

      {/* Header */}
      <div className="relative mb-6">
        <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-200">
            <Icon name="Plus" size={20} strokeWidth={3} />
          </div>
          Registrar <span className="text-blue-600">Progreso</span>
        </h3>
      </div>

      <form onSubmit={handleSubmit} ref={formRef} className="flex flex-col gap-6 relative z-10">
        
        {/* Quick Chips (Accesos Rápidos) */}
        <div>
           <label className={LABEL_STYLE}>Accesos Rápidos</label>
           <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
              {QUICK_METRICS.map(m => (
                 <button
                    type="button"
                    key={m}
                    onClick={() => handleQuickClick(m)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border ${
                       formData.name === m 
                       ? 'bg-slate-900 border-slate-900 text-white shadow-md transform scale-105' 
                       : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'
                    }`}
                 >
                    {m}
                 </button>
              ))}
           </div>
        </div>

        {/* Inputs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
           
           {/* Selector de Métrica */}
           <div className="relative group">
              <label className={LABEL_STYLE}>Métrica</label>
              <div className="relative">
                 <select 
                    name="name" 
                    value={formData.name} 
                    onChange={handleChange}
                    className={`${INPUT_STYLE} appearance-none cursor-pointer pr-10`}
                 >
                    {catalog.map(item => (
                       <option key={item.id} value={item.name}>
                          {item.name}
                       </option>
                    ))}
                 </select>
                 <div className="absolute right-4 top-4 text-slate-400 pointer-events-none group-focus-within:text-blue-500 transition-colors">
                    <Icon name="ChevronDown" size={20} />
                 </div>
              </div>
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
                    className={`${INPUT_STYLE} pr-16 text-xl tracking-tight`} // Texto más grande para el número
                    autoComplete="off"
                 />
                 <div className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-200 rounded-lg">
                    <span className="text-[10px] font-black text-slate-600 uppercase">
                       {formData.unit || '-'}
                    </span>
                 </div>
              </div>
           </div>
        </div>

        {/* Footer: Fecha y Botón de Acción */}
        <div className="flex items-end gap-5 mt-2">
           <div className="w-1/3 min-w-[130px]">
              <label className={LABEL_STYLE}>Fecha</label>
              <input 
                 type="date" 
                 name="date" 
                 value={formData.date} 
                 onChange={handleChange}
                 className={`${INPUT_STYLE} py-3`}
              />
           </div>

           <div className="flex-1">
              <button 
                 type="submit" 
                 disabled={status === 'submitting' || status === 'loading' || !formData.value}
                 className={`w-full h-[52px] rounded-xl font-bold uppercase tracking-widest text-xs transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${
                    status === 'success' 
                       ? 'bg-emerald-500 text-white shadow-emerald-200 hover:bg-emerald-600'
                       : status === 'error'
                          ? 'bg-red-500 text-white shadow-red-200'
                          : 'bg-blue-600 text-white shadow-blue-200 hover:bg-slate-900 hover:shadow-slate-300'
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