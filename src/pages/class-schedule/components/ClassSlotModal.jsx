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
    selectedCoachIds: slotInfo.coachIds || [],
    capacity: slotInfo.capacity || 20,
    startTime: slotInfo.startTime || '10:00',
    endTime: slotInfo.endTime || '11:00',
    dayOfWeek: slotInfo.dayOfWeek
  });

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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-end md:items-center justify-center p-0 md:p-4 transition-all">
      {/* Container: Full width en mobile, centrado en desktop */}
      <div className="bg-card border-t md:border border-border rounded-t-2xl md:rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] animate-in slide-in-from-bottom md:zoom-in-95 duration-200">
        
        {/* Indicador visual de "arrastre" solo en mobile */}
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3 mb-1 md:hidden" />

        <div className="flex justify-between items-center p-4 md:p-5 border-b border-border">
          <div>
            <h3 className="font-bold text-lg md:text-xl text-foreground">
              {isEditing ? 'Editar Clase' : 'Programar Clase'}
            </h3>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {days[formData.dayOfWeek]}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors"
          >
            <Icon name="X" size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-6 overflow-y-auto custom-scrollbar pb-10 md:pb-6">
          
          {/* Actividad con selector visual mejorado */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Actividad</label>
            <select 
              className="w-full h-11 px-3 rounded-lg bg-muted/20 border border-border text-sm focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
              value={formData.classTypeId}
              onChange={e => setFormData({...formData, classTypeId: e.target.value})}
              required
            >
              <option value="">Seleccionar actividad...</option>
              {classTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Profesores con diseño de chips/lista compacta */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Profesores a Cargo</label>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto p-1 rounded-lg">
              {coaches.map(c => {
                const isSelected = formData.selectedCoachIds.includes(c.id);
                return (
                  <label 
                    key={c.id} 
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                        : 'bg-muted/10 border-border text-foreground hover:bg-muted/20'
                    }`}
                  >
                    <span className="text-sm font-semibold">{c.name}</span>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded-full border-2 border-primary text-primary focus:ring-primary accent-primary"
                      checked={isSelected}
                      onChange={() => toggleCoach(c.id)}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* Horarios en una sola fila */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Inicia</label>
              <input 
                type="time" 
                className="w-full h-11 px-3 rounded-lg bg-muted/20 border border-border text-sm font-mono focus:ring-2 focus:ring-primary outline-none"
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Finaliza</label>
              <input 
                type="time" 
                className="w-full h-11 px-3 rounded-lg bg-muted/20 border border-border text-sm font-mono focus:ring-2 focus:ring-primary outline-none"
                value={formData.endTime}
                onChange={e => setFormData({...formData, endTime: e.target.value})}
                required 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Cupo de Atletas</label>
            <div className="flex items-center gap-4">
               <input 
                type="number" 
                className="flex-1 h-11 px-3 rounded-lg bg-muted/20 border border-border text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                value={formData.capacity}
                onChange={e => setFormData({...formData, capacity: e.target.value})}
              />
              <span className="text-xs text-muted-foreground font-medium italic">Atletas máx.</span>
            </div>
          </div>

          {/* Acciones principales fijas al fondo en mobile */}
          <div className="flex flex-col-reverse md:flex-row justify-between gap-3 pt-4 border-t border-border mt-4">
            {isEditing && (
              <Button 
                type="button" 
                variant="ghost" 
                className="text-error hover:bg-error/10 h-11 font-bold" 
                onClick={handleDelete}
              >
                Eliminar Clase
              </Button>
            )}
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto md:ml-auto">
              <Button 
                type="button" 
                variant="ghost" 
                className="h-11 md:px-6"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                loading={loading}
                className="h-11 md:px-8 shadow-lg shadow-primary/20"
              >
                {isEditing ? 'Guardar Cambios' : 'Crear Horario'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassSlotModal;