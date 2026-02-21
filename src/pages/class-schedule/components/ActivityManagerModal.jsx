import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';

const ActivityManagerModal = ({ onClose }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Estado para nueva actividad
  const [newActivity, setNewActivity] = useState({ name: '', color: '#3b82f6' });

  const fetchActivities = async () => {
    const { data } = await supabase.from('class_types').select('*').order('name');
    setActivities(data || []);
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newActivity.name.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('class_types').insert({
        name: newActivity.name.trim(),
        color: newActivity.color
      });
      if (error) throw error;
      setNewActivity({ name: '', color: '#3b82f6' });
      fetchActivities();
    } catch (error) {
      alert("Error al agregar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Borrar esta actividad? Se eliminarán los horarios asociados.")) return;
    try {
      await supabase.from('class_types').delete().eq('id', id);
      fetchActivities();
    } catch (error) {
      alert("Error al eliminar: " + error.message);
    }
  };

  const inputClasses = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all placeholder:text-slate-400 shadow-sm";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
      
      <div className="bg-white border-t md:border border-slate-100 rounded-t-[2rem] md:rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col h-[85vh] md:h-[600px] max-h-[800px] animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
        
        {/* Agarradera Mobile */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 md:hidden shrink-0" />

        {/* Header */}
        <div className="flex justify-between items-center p-5 md:p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
              <Icon name="Settings" size={20} />
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-800 tracking-tight leading-none">
                Actividades
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Tipos de clases
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Lista de Actividades */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-3 custom-scrollbar bg-slate-50/50">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              <Icon name="List" size={32} className="text-slate-300 mb-3" />
              <p className="text-sm font-black text-slate-700 mb-1">Sin actividades</p>
              <p className="text-xs font-medium text-slate-400">Agrega disciplinas como Funcional o Boxeo para comenzar.</p>
            </div>
          ) : (
            activities.map(act => (
              <div 
                key={act.id} 
                className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-lg shadow-inner flex items-center justify-center text-white"
                    style={{ backgroundColor: act.color }}
                  >
                    <Icon name="Activity" size={14} />
                  </div>
                  <span className="font-bold text-slate-700 text-sm">{act.name}</span>
                </div>
                <button 
                  onClick={() => handleDelete(act.id)} 
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                  title="Eliminar actividad"
                >
                  <Icon name="Trash2" size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Formulario de Agregar (Footer) */}
        <form onSubmit={handleAdd} className="p-5 md:p-6 bg-slate-50 border-t border-slate-100 rounded-b-[2rem] shrink-0">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 ml-1">
            Crear Nueva Actividad
          </label>
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <input 
                placeholder="Nombre (Ej: Crossfit)" 
                value={newActivity.name} 
                onChange={e => setNewActivity({...newActivity, name: e.target.value})} 
                required
                className={inputClasses}
              />
            </div>
            {/* Input de color estilizado */}
            <div className="relative w-12 h-[44px] shrink-0 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm flex items-center justify-center hover:border-slate-300 transition-colors cursor-pointer">
              <input 
                type="color" 
                value={newActivity.color}
                onChange={e => setNewActivity({...newActivity, color: e.target.value})}
                className="absolute -inset-2 w-16 h-16 cursor-pointer opacity-0"
              />
              <div 
                className="w-6 h-6 rounded-full border-2 border-white shadow-sm pointer-events-none"
                style={{ backgroundColor: newActivity.color }}
              ></div>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading || !newActivity.name.trim()}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md ${
              loading || !newActivity.name.trim()
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 shadow-blue-200'
            }`}
          >
            {loading ? <Icon name="Loader" size={16} className="animate-spin" /> : <Icon name="Plus" size={16} />}
            Agregar Actividad
          </button>
        </form>
        
      </div>
    </div>
  );
};

export default ActivityManagerModal;