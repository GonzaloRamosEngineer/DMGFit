import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const CreatePlanModal = ({ plan, professors, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    capacity: '',
    status: 'active',
    schedule: [{ day: 'Lunes', time: '08:00 - 09:00' }],
    professorIds: [], // Usamos IDs aquí
    features: ['']
  });

  useEffect(() => {
    if (plan) {
      setFormData({
        ...plan,
        schedule: plan.schedule?.length ? plan.schedule : [{ day: 'Lunes', time: '08:00 - 09:00' }],
        features: plan.features?.length ? plan.features : [''],
        professorIds: plan.professorIds || []
      });
    }
  }, [plan]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleScheduleChange = (index, field, value) => {
    const newSchedule = [...formData.schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setFormData(prev => ({ ...prev, schedule: newSchedule }));
  };

  const addScheduleSlot = () => {
    setFormData(prev => ({ ...prev, schedule: [...prev.schedule, { day: 'Lunes', time: '08:00 - 09:00' }] }));
  };

  const removeScheduleSlot = (index) => {
    setFormData(prev => ({ ...prev, schedule: prev.schedule.filter((_, i) => i !== index) }));
  };

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData(prev => ({ ...prev, features: newFeatures }));
  };

  const addFeature = () => {
    setFormData(prev => ({ ...prev, features: [...prev.features, ''] }));
  };

  const removeFeature = (index) => {
    setFormData(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
  };

  const toggleProfessor = (profId) => {
    setFormData(prev => ({
      ...prev,
      professorIds: prev.professorIds.includes(profId)
        ? prev.professorIds.filter(id => id !== profId)
        : [...prev.professorIds, profId]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      price: Number(formData.price),
      capacity: Number(formData.capacity),
      features: formData.features.filter(f => f.trim() !== '')
    });
  };

  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-heading font-bold text-foreground">
            {plan ? 'Editar Plan' : 'Crear Nuevo Plan'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-smooth">
            <Icon name="X" size={20} color="var(--color-muted-foreground)" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">Nombre del Plan *</label>
              <Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="Ej: Plan Elite" required />
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-foreground mb-2">Precio Mensual ($) *</label>
              <Input id="price" name="price" type="number" value={formData.price} onChange={handleInputChange} placeholder="150" required />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">Descripción *</label>
            <textarea
              id="description" name="description" value={formData.description} onChange={handleInputChange}
              placeholder="Describe el plan de entrenamiento..." rows={3}
              className="w-full px-4 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="capacity" className="block text-sm font-medium text-foreground mb-2">Capacidad Máxima *</label>
              <Input id="capacity" name="capacity" type="number" value={formData.capacity} onChange={handleInputChange} placeholder="25" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Estado</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className="w-full h-10 px-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-foreground">Horarios *</label>
              <Button type="button" variant="outline" size="sm" iconName="Plus" onClick={addScheduleSlot}>Agregar Horario</Button>
            </div>
            <div className="space-y-3">
              {formData.schedule.map((slot, index) => (
                <div key={index} className="flex gap-2">
                  <select
                    value={slot.day}
                    onChange={(e) => handleScheduleChange(index, 'day', e.target.value)}
                    className="flex-1 h-10 px-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
                  >
                    {days.map(day => <option key={day} value={day}>{day}</option>)}
                  </select>
                  <Input value={slot.time} onChange={(e) => handleScheduleChange(index, 'time', e.target.value)} placeholder="08:00 - 09:00" className="flex-1" />
                  {formData.schedule.length > 1 && (
                    <button type="button" onClick={() => removeScheduleSlot(index)} className="p-2 hover:bg-error/10 rounded-lg transition-smooth">
                      <Icon name="Trash2" size={20} color="var(--color-error)" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Profesores Asignados</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {professors.length > 0 ? professors.map((prof) => (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => toggleProfessor(prof.id)}
                  className={`p-3 rounded-lg border transition-smooth text-left flex items-center gap-2 ${
                    formData.professorIds.includes(prof.id)
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-muted/50 border-border hover:border-primary/50'
                  }`}
                >
                  <Icon name={formData.professorIds.includes(prof.id) ? 'CheckCircle' : 'Circle'} size={16} />
                  <span className="text-sm font-medium">{prof.name}</span>
                </button>
              )) : <p className="text-sm text-muted-foreground">No hay profesores registrados.</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-foreground">Características</label>
              <Button type="button" variant="outline" size="sm" iconName="Plus" onClick={addFeature}>Agregar</Button>
            </div>
            <div className="space-y-2">
              {formData.features.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <Input value={feature} onChange={(e) => handleFeatureChange(index, e.target.value)} placeholder="Ej: Entrenamiento personalizado" className="flex-1" />
                  {formData.features.length > 1 && (
                    <button type="button" onClick={() => removeFeature(index)} className="p-2 hover:bg-error/10 rounded-lg transition-smooth">
                      <Icon name="Trash2" size={20} color="var(--color-error)" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-border sticky bottom-0 bg-card">
            <Button type="button" variant="outline" size="md" onClick={onClose} fullWidth>Cancelar</Button>
            <Button type="submit" variant="default" size="md" iconName="Save" fullWidth>
              {plan ? 'Guardar Cambios' : 'Crear Plan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePlanModal;