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

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-white border-t md:border border-slate-200 rounded-t-[2rem] md:rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col h-[85vh] md:h-[600px] max-h-[800px]">
        {/* Mobile handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 md:hidden shrink-0" />

        {/* Header */}
        <div className="flex justify-between items-center px-5 md:px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Icon name="Layers" size={18} className="text-indigo-500" />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900 tracking-tight leading-none">
                Actividades
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {activities.length} tipo{activities.length === 1 ? '' : 's'} de clase
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 md:px-6 pt-4 pb-3 shrink-0">
          <div className="relative">
            <Icon
              name="Search"
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Buscar actividad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 transition-all"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 md:px-6 pb-4 custom-scrollbar">
          {fetching ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[58px] bg-slate-100 rounded-xl" />
              ))}
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10 border-2 border-dashed border-slate-200 rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <Icon name="List" size={22} className="text-slate-300" />
              </div>
              <p className="text-sm font-black text-slate-700 mb-1">
                {searchTerm ? 'Sin coincidencias' : 'Sin actividades'}
              </p>
              <p className="text-xs text-slate-400 max-w-[200px]">
                {searchTerm
                  ? 'Prueba con otro nombre.'
                  : 'Agrega disciplinas como Funcional o Boxeo para comenzar.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredActivities.map((act) => (
                <div
                  key={act.id}
                  className="group flex items-center justify-between px-3 py-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all"
                  style={{ borderLeft: `3px solid ${act.color}` }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Color dot */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: act.color + '18' }}
                    >
                      <Icon name="Activity" size={14} style={{ color: act.color }} />
                    </div>
                    <span className="font-bold text-slate-800 text-sm truncate">{act.name}</span>
                  </div>

                  <button
                    onClick={() => handleDelete(act.id, act.name)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="Eliminar"
                  >
                    <Icon name="Trash2" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — crear nueva */}
        <form
          onSubmit={handleAdd}
          className="px-5 md:px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-[2rem] shrink-0"
        >
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            Crear nueva actividad
          </p>

          {formError && (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 flex items-start gap-2">
              <Icon name="AlertCircle" size={14} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700 font-medium">{formError}</p>
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <input
              placeholder="Nombre (Ej: Crossfit)"
              value={newActivity.name}
              onChange={(e) => {
                setFormError('');
                setNewActivity({ ...newActivity, name: e.target.value });
              }}
              required
              className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400 shadow-sm"
            />

            {/* Color picker */}
            <div
              className="relative w-11 h-[42px] shrink-0 rounded-xl border-2 overflow-hidden cursor-pointer transition-all hover:scale-105"
              style={{ borderColor: newActivity.color }}
              title="Elegir color"
            >
              <input
                type="color"
                value={newActivity.color}
                onChange={(e) => setNewActivity({ ...newActivity, color: e.target.value })}
                className="absolute -inset-2 w-16 h-16 cursor-pointer opacity-0"
              />
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ backgroundColor: newActivity.color + '22' }}
              >
                <div
                  className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: newActivity.color }}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !newActivity.name.trim()}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
              loading || !newActivity.name.trim()
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'text-white hover:-translate-y-0.5 shadow-md active:translate-y-0'
            }`}
            style={
              !loading && newActivity.name.trim()
                ? {
                    backgroundColor: newActivity.color,
                    boxShadow: `0 4px 14px ${newActivity.color}40`,
                  }
                : {}
            }
          >
            {loading ? (
              <Icon name="Loader" size={15} className="animate-spin" />
            ) : (
              <Icon name="Plus" size={15} />
            )}
            {loading ? 'Agregando...' : 'Agregar actividad'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ActivityManagerModal;