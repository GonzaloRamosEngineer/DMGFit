import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient'; // Ajusta la ruta si es necesario
import Icon from '../../../components/AppIcon';

export default function MetricEntryForm({ athleteId, onSuccess }) {
  // Estado del Formulario
  const [formData, setFormData] = useState({
    name: '', // Ahora empieza vacío hasta que cargue el catálogo
    unit: '',
    value: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Estado del Catálogo (La lista que viene de DB)
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  
  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // 1. CARGAR CATÁLOGO AL INICIAR
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        // Gracias a RLS, esto traerá: Globales + Las creadas por ESTE usuario
        const { data, error } = await supabase
          .from('metrics_catalog')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;

        setCatalog(data || []);
        
        // Pre-seleccionar la primera opción si existe
        if (data && data.length > 0) {
           // Buscamos "Peso Corporal" por defecto, si no, la primera
           const defaultMetric = data.find(m => m.name === 'Peso Corporal') || data[0];
           setFormData(prev => ({
             ...prev,
             name: defaultMetric.name,
             unit: defaultMetric.unit
           }));
        }
      } catch (err) {
        console.error("Error cargando catálogo:", err);
      } finally {
        setLoadingCatalog(false);
      }
    };

    fetchCatalog();
  }, []);

  // 2. MANEJAR CAMBIOS EN EL FORMULARIO
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia el SELECT de métrica, actualizamos la unidad automáticamente
    if (name === 'name') {
      const selectedItem = catalog.find(item => item.name === value);
      setFormData(prev => ({
        ...prev,
        name: value,
        unit: selectedItem ? selectedItem.unit : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // 3. ENVIAR DATOS (GUARDAR)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!athleteId) return;

    setLoading(true);
    setError(null);
    setSuccessMsg('');

    try {
      if (!formData.value) throw new Error("Ingresa un valor");

      // Insertar en la tabla REAL de datos
      const { error: insertError } = await supabase
        .from('performance_metrics')
        .insert([{
          athlete_id: athleteId,
          name: formData.name,
          value: formData.value,
          unit: formData.unit,
          metric_date: formData.date
        }]);

      if (insertError) throw insertError;

      // Éxito
      setSuccessMsg('¡Guardado!');
      setFormData(prev => ({ ...prev, value: '' })); // Limpiar valor
      
      // Avisar al padre para recargar gráficos
      if (onSuccess) onSuccess();

      // Limpiar mensaje de éxito después de 3 seg
      setTimeout(() => setSuccessMsg(''), 3000);
      
    } catch (err) {
      console.error(err);
      setError("Error al guardar.");
    } finally {
      setLoading(false);
    }
  };

  if (loadingCatalog) return <div className="p-4 text-xs text-gray-400">Cargando métricas...</div>;

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Icon name="PlusCircle" className="text-blue-600" size={18} />
            Registrar Progreso
        </h3>
        {successMsg && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded animate-pulse">{successMsg}</span>}
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        {/* FILA 1: Selector y Valor */}
        <div className="flex gap-3">
            {/* Selector Dinámico (Viene de DB) */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Métrica</label>
              <div className="relative">
                  <select 
                    name="name" 
                    value={formData.name} 
                    onChange={handleChange}
                    className="w-full p-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-medium text-gray-700"
                  >
                    {catalog.map(item => (
                      <option key={item.id} value={item.name}>
                        {item.name} {item.is_global ? '' : '(Personal)'}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                      <Icon name="ChevronDown" size={14} />
                  </div>
              </div>
            </div>

            {/* Input Valor */}
            <div className="w-1/3 relative">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Valor</label>
              <input 
                type="number" 
                step="0.01" 
                name="value" 
                value={formData.value} 
                onChange={handleChange}
                placeholder="0.00"
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-900"
              />
              <span className="absolute right-3 top-[29px] text-xs text-gray-400 font-medium">{formData.unit}</span>
            </div>
        </div>

        {/* FILA 2: Fecha y Botón */}
        <div className="flex gap-3 items-end">
            <div className="flex-1">
                 <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fecha</label>
                 <input 
                  type="date" 
                  name="date" 
                  value={formData.date} 
                  onChange={handleChange}
                  className="w-full p-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 px-6 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-[42px]"
            >
                {loading ? 'Guardando...' : 'Guardar'}
            </button>
        </div>

        {error && <p className="text-red-500 text-xs text-center">{error}</p>}
      </form>
    </div>
  );
}