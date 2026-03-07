import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';

const ActivityManagerModal = ({ onClose }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState('');

  const [newActivity, setNewActivity] = useState({
    name: '',
    color: '#3b82f6',
  });

  const fetchActivities = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from('class_types')
        .select('*')
        .order('name');

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error cargando actividades:', error);
      setFormError('No se pudieron cargar las actividades.');
      setActivities([]);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const filteredActivities = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return activities;
    return activities.filter((a) =>
      String(a.name || '').toLowerCase().includes(term)
    );
  }, [activities, searchTerm]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = newActivity.name.trim();
    if (!trimmedName) {
      setFormError('Escribe un nombre para la actividad.');
      return;
    }

    const duplicate = activities.some(
      (a) => String(a.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      setFormError('Ya existe una actividad con ese nombre.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('class_types').insert({
        name: trimmedName,
        color: newActivity.color,
      });

      if (error) throw error;

      setNewActivity({ name: '', color: '#3b82f6' });
      await fetchActivities();
    } catch (error) {
      console.error('Error agregando actividad:', error);
      setFormError(error.message || 'No se pudo agregar la actividad.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    const confirmDelete = window.confirm(
      `¿Seguro que quieres eliminar la actividad "${name}"?\n\nEsta acción puede impactar horarios relacionados según la configuración actual de la base.`
    );
    if (!confirmDelete) return;

    try {
      const { error } = await supabase.from('class_types').delete().eq('id', id);
      if (error) throw error;
      await fetchActivities();
    } catch (error) {
      console.error('Error eliminando actividad:', error);
      setFormError(error.message || 'No se pudo eliminar la actividad.');
    }
  };

  const inputClasses =
    'w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all placeholder:text-slate-400 shadow-sm';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-white border-t md:border border-slate-100 rounded-t-[2rem] md:rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col h-[85vh] md:h-[600px] max-h-[800px] animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
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
                {activities.length} tipo{activities.length === 1 ? '' : 's'} de clase
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

        {/* Search */}
        <div className="px-5 md:px-6 pt-4 shrink-0 bg-white">
          <div className="relative">
            <Icon
              name="Search"
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Buscar actividad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-300 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-3 custom-scrollbar bg-slate-50/50">
          {fetching ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-white rounded-xl border border-slate-100"></div>
              ))}
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              <Icon name="List" size={32} className="text-slate-300 mb-3" />
              <p className="text-sm font-black text-slate-700 mb-1">
                {searchTerm ? 'No hay coincidencias' : 'Sin actividades'}
              </p>
              <p className="text-xs font-medium text-slate-400">
                {searchTerm
                  ? 'Prueba con otro nombre.'
                  : 'Agrega disciplinas como Funcional o Boxeo para comenzar.'}
              </p>
            </div>
          ) : (
            filteredActivities.map((act) => (
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
                  onClick={() => handleDelete(act.id, act.name)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                  title="Eliminar actividad"
                >
                  <Icon name="Trash2" size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <form
          onSubmit={handleAdd}
          className="p-5 md:p-6 bg-slate-50 border-t border-slate-100 rounded-b-[2rem] shrink-0"
        >
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 ml-1">
            Crear Nueva Actividad
          </label>

          {formError && (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-medium">
              {formError}
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <input
                placeholder="Nombre (Ej: Crossfit)"
                value={newActivity.name}
                onChange={(e) => {
                  setFormError('');
                  setNewActivity({ ...newActivity, name: e.target.value });
                }}
                required
                className={inputClasses}
              />
            </div>

            <div className="relative w-12 h-[44px] shrink-0 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm flex items-center justify-center hover:border-slate-300 transition-colors cursor-pointer">
              <input
                type="color"
                value={newActivity.color}
                onChange={(e) => setNewActivity({ ...newActivity, color: e.target.value })}
                className="absolute -inset-2 w-16 h-16 cursor-pointer opacity-0"
              />
              <div
                className="w-6 h-6 rounded-full border-2 border-white shadow-sm pointer-events-none"
                style={{ backgroundColor: newActivity.color }}
              />
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
            {loading ? (
              <Icon name="Loader" size={16} className="animate-spin" />
            ) : (
              <Icon name="Plus" size={16} />
            )}
            Agregar Actividad
          </button>
        </form>
      </div>
    </div>
  );
};

export default ActivityManagerModal;