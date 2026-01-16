import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

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
    if (!newActivity.name) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('class_types').insert(newActivity);
      if (error) throw error;
      setNewActivity({ name: '', color: '#3b82f6' });
      fetchActivities();
    } catch (error) {
      alert(error.message);
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
      alert(error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl h-[500px] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h3 className="font-bold text-lg">Gestionar Actividades</h3>
          <button onClick={onClose}><Icon name="X" size={20} /></button>
        </div>

        {/* Lista de Actividades */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activities.length === 0 && <p className="text-center text-muted-foreground text-sm">No hay actividades creadas.</p>}
          
          {activities.map(act => (
            <div key={act.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border border-border" style={{ backgroundColor: act.color }}></div>
                <span className="font-medium">{act.name}</span>
              </div>
              <button onClick={() => handleDelete(act.id)} className="text-muted-foreground hover:text-error">
                <Icon name="Trash2" size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Formulario de Agregar */}
        <form onSubmit={handleAdd} className="p-4 border-t border-border bg-muted/10 space-y-3">
          <p className="text-xs font-bold uppercase text-muted-foreground">Crear Nueva</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input 
                placeholder="Nombre (Ej: Boxeo)" 
                value={newActivity.name} 
                onChange={e => setNewActivity({...newActivity, name: e.target.value})} 
                required
              />
            </div>
            <input 
              type="color" 
              className="w-10 h-10 rounded cursor-pointer border border-border p-1 bg-card"
              value={newActivity.color}
              onChange={e => setNewActivity({...newActivity, color: e.target.value})}
            />
          </div>
          <Button type="submit" fullWidth loading={loading} iconName="Plus">Agregar Actividad</Button>
        </form>
      </div>
    </div>
  );
};

export default ActivityManagerModal;