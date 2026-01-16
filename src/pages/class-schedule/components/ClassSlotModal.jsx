import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ClassSlotModal = ({ slotInfo, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [classTypes, setClassTypes] = useState([]);
  const [coaches, setCoaches] = useState([]);
  
  const isEditing = !!slotInfo.id;

  const [formData, setFormData] = useState({
    classTypeId: slotInfo.classTypeId || '',
    selectedCoachIds: slotInfo.coachIds || [], // Ahora es un Array
    capacity: slotInfo.capacity || 20,
    startTime: slotInfo.startTime || '10:00',
    endTime: slotInfo.endTime || '11:00',
    dayOfWeek: slotInfo.dayOfWeek
  });

  // Cargar datos
  useEffect(() => {
    const fetchData = async () => {
      const [typesRes, coachesRes] = await Promise.all([
        supabase.from('class_types').select('*').order('name'),
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

  // Manejo de checkboxes de profes
  const toggleCoach = (coachId) => {
    setFormData(prev => {
      const exists = prev.selectedCoachIds.includes(coachId);
      if (exists) return { ...prev, selectedCoachIds: prev.selectedCoachIds.filter(id => id !== coachId) };
      return { ...prev, selectedCoachIds: [...prev.selectedCoachIds, coachId] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Guardar/Actualizar el Horario Base
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
        // Borramos relaciones viejas de profes para re-crearlas
        await supabase.from('schedule_coaches').delete().eq('schedule_id', scheduleId);
      } else {
        const { data, error } = await supabase.from('weekly_schedule').insert(schedulePayload).select().single();
        if (error) throw error;
        scheduleId = data.id;
      }

      // 2. Insertar las relaciones con los Profes seleccionados
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
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Borrar este horario?")) return;
    setLoading(true);
    await supabase.from('weekly_schedule').delete().eq('id', slotInfo.id);
    onSuccess();
    onClose();
  };

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h3 className="font-bold text-lg">
            {isEditing ? 'Editar' : 'Nuevo'} Horario - {days[formData.dayOfWeek]}
          </h3>
          <button onClick={onClose}><Icon name="X" size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Profesores a Cargo</label>
            <div className="border border-border rounded-md p-2 max-h-32 overflow-y-auto bg-input/20">
              {coaches.map(c => (
                <label key={c.id} className="flex items-center gap-2 p-1.5 hover:bg-muted/50 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.selectedCoachIds.includes(c.id)}
                    onChange={() => toggleCoach(c.id)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm">{c.name}</span>
                </label>
              ))}
            </div>
            {formData.selectedCoachIds.length === 0 && <p className="text-xs text-warning">Advertencia: Sin profesor asignado</p>}
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
            ) : <div></div>}
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