import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ClassSlotModal = ({ slotInfo, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [classTypes, setClassTypes] = useState([]);
  const [coaches, setCoaches] = useState([]);

  // Si slotInfo tiene 'id', es edición. Si no, es creación.
  const isEditing = !!slotInfo.id;

  const [formData, setFormData] = useState({
    classTypeId: slotInfo.classTypeId || '',
    coachId: slotInfo.coachId || '',
    capacity: slotInfo.capacity || 20,
    startTime: slotInfo.startTime || '10:00',
    endTime: slotInfo.endTime || '11:00',
    dayOfWeek: slotInfo.dayOfWeek // Viene fijo del click en la grilla
  });

  // Cargar listas desplegables
  useEffect(() => {
    const fetchData = async () => {
      const [typesRes, coachesRes] = await Promise.all([
        supabase.from('class_types').select('*'),
        supabase.from('coaches').select('id, profiles:profile_id(full_name)')
      ]);
      
      if (typesRes.data) setClassTypes(typesRes.data);
      if (coachesRes.data) setCoaches(coachesRes.data.map(c => ({
        id: c.id, 
        name: c.profiles?.full_name || 'Sin Nombre'
      })));
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        class_type_id: formData.classTypeId,
        coach_id: formData.coachId,
        day_of_week: formData.dayOfWeek,
        start_time: formData.startTime,
        end_time: formData.endTime,
        capacity: formData.capacity
      };

      if (isEditing) {
        const { error } = await supabase.from('weekly_schedule').update(payload).eq('id', slotInfo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('weekly_schedule').insert(payload);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error) {
      alert("Error guardando horario: " + error.message);
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
      alert("Error eliminando: " + error.message);
      setLoading(false);
    }
  };

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h3 className="font-bold text-lg">
            {isEditing ? 'Editar Horario' : 'Nuevo Horario'} - {days[formData.dayOfWeek]}
          </h3>
          <button onClick={onClose}><Icon name="X" size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Actividad</label>
            <select 
              className="w-full p-2 rounded-md bg-input border border-border"
              value={formData.classTypeId}
              onChange={e => setFormData({...formData, classTypeId: e.target.value})}
              required
            >
              <option value="">Seleccionar...</option>
              {classTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Profesor a Cargo</label>
            <select 
              className="w-full p-2 rounded-md bg-input border border-border"
              value={formData.coachId}
              onChange={e => setFormData({...formData, coachId: e.target.value})}
              required
            >
              <option value="">Seleccionar...</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Inicio</label>
              <input 
                type="time" 
                className="w-full p-2 rounded-md bg-input border border-border"
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Fin</label>
              <input 
                type="time" 
                className="w-full p-2 rounded-md bg-input border border-border"
                value={formData.endTime}
                onChange={e => setFormData({...formData, endTime: e.target.value})}
                required 
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Cupo Máximo</label>
            <input 
              type="number" 
              className="w-full p-2 rounded-md bg-input border border-border"
              value={formData.capacity}
              onChange={e => setFormData({...formData, capacity: e.target.value})}
            />
          </div>

          <div className="flex justify-between pt-4">
            {isEditing ? (
              <Button type="button" variant="ghost" className="text-error hover:bg-error/10" onClick={handleDelete}>Eliminar</Button>
            ) : (
              <div></div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" loading={loading}>{isEditing ? 'Guardar' : 'Crear'}</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassSlotModal;