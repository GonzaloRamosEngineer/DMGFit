import React, { useState, useEffect } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';

const PlanForm = ({ plan, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    capacity: '',
    schedule: [{ day: '', time: '' }],
    professors: [''],
    status: 'draft',
    features: ['']
  });

  useEffect(() => {
    if (plan) {
      setFormData(plan);
    }
  }, [plan]);

  const handleInputChange = (e) => {
    const { name, value } = e?.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleScheduleChange = (index, field, value) => {
    const newSchedule = [...formData?.schedule];
    newSchedule[index] = { ...newSchedule?.[index], [field]: value };
    setFormData(prev => ({ ...prev, schedule: newSchedule }));
  };

  const addScheduleSlot = () => {
    setFormData(prev => ({
      ...prev,
      schedule: [...prev?.schedule, { day: '', time: '' }]
    }));
  };

  const removeScheduleSlot = (index) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev?.schedule?.filter((_, i) => i !== index)
    }));
  };

  const handleProfessorChange = (index, value) => {
    const newProfessors = [...formData?.professors];
    newProfessors[index] = value;
    setFormData(prev => ({ ...prev, professors: newProfessors }));
  };

  const addProfessor = () => {
    setFormData(prev => ({ ...prev, professors: [...prev?.professors, ''] }));
  };

  const removeProfessor = (index) => {
    setFormData(prev => ({
      ...prev,
      professors: prev?.professors?.filter((_, i) => i !== index)
    }));
  };

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...formData?.features];
    newFeatures[index] = value;
    setFormData(prev => ({ ...prev, features: newFeatures }));
  };

  const addFeature = () => {
    setFormData(prev => ({ ...prev, features: [...prev?.features, ''] }));
  };

  const removeFeature = (index) => {
    setFormData(prev => ({
      ...prev,
      features: prev?.features?.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const cleanedData = {
      ...formData,
      price: Number(formData?.price),
      capacity: Number(formData?.capacity),
      schedule: formData?.schedule?.filter(s => s?.day && s?.time),
      professors: formData?.professors?.filter(p => p?.trim()),
      features: formData?.features?.filter(f => f?.trim())
    };
    onSave(cleanedData);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-heading font-bold text-foreground">
            {plan ? 'Editar Plan' : 'Crear Nuevo Plan'}
          </h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-smooth">
            <Icon name="X" size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">Nombre del Plan</label>
              <Input
                name="name"
                value={formData?.name}
                onChange={handleInputChange}
                placeholder="Ej: Plan Elite"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">Descripción</label>
              <textarea
                name="description"
                value={formData?.description}
                onChange={handleInputChange}
                placeholder="Describe el plan..."
                rows={3}
                className="w-full px-4 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Precio Mensual ($)</label>
              <Input
                name="price"
                type="number"
                value={formData?.price}
                onChange={handleInputChange}
                placeholder="150"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Capacidad</label>
              <Input
                name="capacity"
                type="number"
                value={formData?.capacity}
                onChange={handleInputChange}
                placeholder="15"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Estado</label>
              <select
                name="status"
                value={formData?.status}
                onChange={handleInputChange}
                className="w-full h-10 px-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
              >
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-foreground">Horarios</label>
              <Button type="button" variant="outline" size="sm" iconName="Plus" onClick={addScheduleSlot}>
                Agregar
              </Button>
            </div>
            <div className="space-y-2">
              {formData?.schedule?.map((slot, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Día"
                    value={slot?.day}
                    onChange={(e) => handleScheduleChange(index, 'day', e?.target?.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Horario"
                    value={slot?.time}
                    onChange={(e) => handleScheduleChange(index, 'time', e?.target?.value)}
                    className="flex-1"
                  />
                  {formData?.schedule?.length > 1 && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      iconName="Trash2"
                      onClick={() => removeScheduleSlot(index)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-foreground">Profesores Asignados</label>
              <Button type="button" variant="outline" size="sm" iconName="Plus" onClick={addProfessor}>
                Agregar
              </Button>
            </div>
            <div className="space-y-2">
              {formData?.professors?.map((prof, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Nombre del profesor"
                    value={prof}
                    onChange={(e) => handleProfessorChange(index, e?.target?.value)}
                    className="flex-1"
                  />
                  {formData?.professors?.length > 1 && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      iconName="Trash2"
                      onClick={() => removeProfessor(index)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-foreground">Características</label>
              <Button type="button" variant="outline" size="sm" iconName="Plus" onClick={addFeature}>
                Agregar
              </Button>
            </div>
            <div className="space-y-2">
              {formData?.features?.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Característica del plan"
                    value={feature}
                    onChange={(e) => handleFeatureChange(index, e?.target?.value)}
                    className="flex-1"
                  />
                  {formData?.features?.length > 1 && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      iconName="Trash2"
                      onClick={() => removeFeature(index)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" size="lg" onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" variant="default" size="lg" iconName="Save" className="flex-1">
              {plan ? 'Guardar Cambios' : 'Crear Plan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanForm;