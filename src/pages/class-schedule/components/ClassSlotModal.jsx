import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';

const ClassSlotModal = ({ slotInfo, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [classTypes, setClassTypes] = useState([]);
  const [coaches, setCoaches] = useState([]);
  
  const isEditing = !!slotInfo.id;

  const [formData, setFormData] = useState({
    classTypeId: slotInfo.classTypeId || '',
    selectedCoachIds: slotInfo.coachIds || [],
    capacity: slotInfo.capacity || 20,
    startTime: slotInfo.startTime || '10:00',
    endTime: slotInfo.endTime || '11:00',
    dayOfWeek: slotInfo.dayOfWeek
  });

  // CARGA DE DATOS: Con manejo de errores silenciosos
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [typesRes, coachesRes] = await Promise.all([
          supabase.from('class_types').select('*').order('name'),
          supabase.from('coaches').select('id, profiles:profile_id(full_name)')
        ]);
        
        if (typesRes.data) {
          setClassTypes(typesRes.data);
        }
        
        if (coachesRes.data) {
          setCoaches(coachesRes.data.map(c => ({
            id: c.id, 
            name: c.profiles?.full_name || 'Sin Nombre'
          })));
        }
      } catch (err) {
        console.error("Error en fetchData:", err);
      }
    };
    fetchData();
  }, []);

  const toggleCoach = (coachId) => {
    setFormData(prev => {
      const exists = prev.selectedCoachIds.includes(coachId);
      if (exists) return { ...prev, selectedCoachIds: prev.selectedCoachIds.filter(id => id !== coachId) };
      return { ...prev, selectedCoachIds: [...prev.selectedCoachIds, coachId] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.classTypeId) {
      alert("Por favor selecciona una actividad");
      return;
    }

    setLoading(true);
    try {
      const schedulePayload = {
        class_type_id: formData.classTypeId,
        day_of_week: formData.dayOfWeek,
        start_time: formData.startTime,
        end_time: formData.endTime,
        capacity: formData.capacity
      };

      let scheduleId = slotInfo.id;

      if (isEditing) {
        await supabase.from('weekly_schedule').update(schedulePayload).eq('id', scheduleId);
        await supabase.from('schedule_coaches').delete().eq('schedule_id', scheduleId);
      } else {
        const { data, error } = await supabase.from('weekly_schedule').insert(schedulePayload).select().single();
        if (error) throw error;
        scheduleId = data.id;
      }

      if (formData.selectedCoachIds.length > 0) {
        const coachRelations = formData.selectedCoachIds.map(coachId => ({
          schedule_id: scheduleId,
          coach_id: coachId
        }));
        await supabase.from('schedule_coaches').insert(coachRelations);
      }

      onSuccess();
      onClose();
    } catch (error) {
      alert("Error al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Borrar este horario?")) return;
    setLoading(true);
    try {
      await supabase.from('weekly_schedule').delete().eq('id', slotInfo.id);
      onSuccess();
      onClose();
    } catch (error) {
      alert("Error al eliminar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Clases Reutilizables
  const inputClasses = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all";
  const labelClasses = "text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 ml-1";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      
      {/* Contenedor Modal */}
      <div className="bg-white border-t md:border border-slate-100 rounded-t-[2rem] md:rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
        
        {/* Agarradera Mobile */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 md:hidden" />

        {/* Header */}
        <div className="flex justify-between items-center p-5 md:p-6 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-black text-xl text-slate-800 tracking-tight">
              {isEditing ? 'Editar Clase' : 'Programar Clase'}
            </h3>
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-1 bg-blue-50 inline-block px-2 py-0.5 rounded-md">
              {days[formData.dayOfWeek]}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* ACTIVIDAD */}
          <div>
            <label className={labelClasses}>Actividad <span className="text-rose-500">*</span></label>
            <div className="relative">
              <select 
                className={`${inputClasses} appearance-none cursor-pointer`}
                value={formData.classTypeId}
                onChange={e => setFormData({...formData, classTypeId: e.target.value})}
                required
              >
                <option value="" disabled>Seleccionar actividad...</option>
                {classTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <Icon name="ChevronDown" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>

          {/* PROFESORES */}
          <div>
            <div className="flex justify-between items-end mb-2 ml-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Profesores a Cargo
              </label>
              {formData.selectedCoachIds.length === 0 && (
                <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded-md">
                  Requerido
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {coaches.map(c => {
                const isSelected = formData.selectedCoachIds.includes(c.id);
                return (
                  <label 
                    key={c.id} 
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-50 border-blue-200 shadow-sm' 
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                        {isSelected ? <Icon name="Check" size={14} strokeWidth={3} /> : <Icon name="User" size={14} />}
                      </div>
                      <span className={`text-sm font-bold ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                        {c.name}
                      </span>
                    </div>
                    {/* Checkbox Oculto para accesibilidad */}
                    <input 
                      type="checkbox" 
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => toggleCoach(c.id)}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* HORARIOS */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Inicia</label>
              <input 
                type="time" 
                className={`${inputClasses} font-mono font-bold text-center`}
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
                required 
              />
            </div>
            <div>
              <label className={labelClasses}>Finaliza</label>
              <input 
                type="time" 
                className={`${inputClasses} font-mono font-bold text-center`}
                value={formData.endTime}
                onChange={e => setFormData({...formData, endTime: e.target.value})}
                required 
              />
            </div>
          </div>

          {/* CUPO */}
          <div>
            <label className={labelClasses}>Cupo Máximo</label>
            <div className="relative">
              <input 
                type="number" 
                className={`${inputClasses} pl-12 font-bold`}
                value={formData.capacity}
                onChange={e => setFormData({...formData, capacity: e.target.value})}
                min="1"
              />
              <Icon name="Users" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold uppercase tracking-widest pointer-events-none">
                Atletas
              </span>
            </div>
          </div>

        </form>

        {/* FOOTER - Botones */}
        <div className="p-5 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between gap-3 shrink-0 pb-8 md:pb-6 rounded-b-[2rem]">
          {isEditing && (
            <button 
              type="button" 
              onClick={handleDelete}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors order-2 sm:order-1"
            >
              <Icon name="Trash2" size={14} /> Eliminar
            </button>
          )}
          
          <div className={`flex gap-3 w-full sm:w-auto ${isEditing ? 'order-1 sm:order-2 ml-auto' : 'w-full justify-end'}`}>
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors uppercase tracking-wider"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white uppercase tracking-wider transition-all shadow-md ${
                loading 
                  ? 'bg-blue-400 cursor-wait' 
                  : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 shadow-blue-200'
              }`}
            >
              {loading ? <Icon name="Loader" size={14} className="animate-spin" /> : <Icon name="Save" size={14} />}
              {isEditing ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ClassSlotModal;