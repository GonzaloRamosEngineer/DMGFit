import React, { useState, useEffect } from 'react';
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
      setFormData({
        ...plan,
        schedule: plan.schedule?.length ? plan.schedule : [{ day: '', time: '' }],
        professors: plan.professors?.length ? plan.professors : [''],
        features: plan.features?.length ? plan.features : ['']
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
    setFormData(prev => ({
      ...prev,
      schedule: [...prev.schedule, { day: '', time: '' }]
    }));
  };

  const removeScheduleSlot = (index) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== index)
    }));
  };

  const handleProfessorChange = (index, value) => {
    const newProfessors = [...formData.professors];
    newProfessors[index] = value;
    setFormData(prev => ({ ...prev, professors: newProfessors }));
  };

  const addProfessor = () => {
    setFormData(prev => ({ ...prev, professors: [...prev.professors, ''] }));
  };

  const removeProfessor = (index) => {
    setFormData(prev => ({
      ...prev,
      professors: prev.professors.filter((_, i) => i !== index)
    }));
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
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanedData = {
      ...formData,
      price: Number(formData.price),
      capacity: Number(formData.capacity),
      schedule: formData.schedule.filter(s => s.day && s.time),
      professors: formData.professors.filter(p => p.trim()),
      features: formData.features.filter(f => f.trim())
    };
    onSave(cleanedData);
  };

  // Clases Reutilizables
  const inputClasses = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all placeholder:text-slate-400";
  const labelClasses = "text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div className="bg-white border border-slate-100 rounded-[2rem] w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
              <Icon name={plan ? "Edit" : "PlusCircle"} size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                {plan ? 'Editar Plan' : 'Crear Nuevo Plan'}
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5">
                Configura los detalles del servicio
              </p>
            </div>
          </div>
          <button 
            onClick={onCancel} 
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Formulario con Scroll (GRID 2 Columnas) */}
        <form id="plan-form-standalone" onSubmit={handleSubmit} className="overflow-y-auto p-6 custom-scrollbar flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
            
            {/* --- COLUMNA IZQUIERDA --- */}
            <div className="space-y-8">
              
              {/* Sección 1: Info Básica */}
              <section>
                <div className="flex items-center gap-2 pb-2 mb-5 border-b border-slate-100">
                  <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-500 flex items-center justify-center">
                    <Icon name="Info" size={12} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">Información Principal</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelClasses}>Nombre del Plan <span className="text-rose-500">*</span></label>
                    <input name="name" value={formData.name} onChange={handleInputChange} placeholder="Ej: Plan Elite Crossfit" required className={inputClasses} />
                  </div>
                  
                  <div>
                    <label className={labelClasses}>Descripción <span className="text-rose-500">*</span></label>
                    <textarea 
                      name="description" 
                      value={formData.description} 
                      onChange={handleInputChange} 
                      placeholder="Describe qué incluye este plan..." 
                      rows={3} 
                      className={`${inputClasses} resize-none`} 
                      required 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Precio Mensual <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input name="price" type="number" value={formData.price} onChange={handleInputChange} placeholder="150" required className={`${inputClasses} pl-7`} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClasses}>Capacidad Max. <span className="text-rose-500">*</span></label>
                      <input name="capacity" type="number" value={formData.capacity} onChange={handleInputChange} placeholder="Ej: 25" required className={inputClasses} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClasses}>Estado del Plan</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} className={`${inputClasses} appearance-none cursor-pointer`}>
                      <option value="draft">Borrador (Oculto)</option>
                      <option value="active">Activo (Visible)</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>
                </div>
              </section>

            </div>

            {/* --- COLUMNA DERECHA --- */}
            <div className="space-y-8">
              
              {/* Sección 2: Horarios */}
              <section>
                <div className="flex items-center justify-between pb-2 mb-5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-500 flex items-center justify-center">
                      <Icon name="Clock" size={12} />
                    </div>
                    <h3 className="text-sm font-black text-slate-800">Grilla de Horarios</h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={addScheduleSlot}
                    className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md uppercase tracking-widest transition-colors flex items-center gap-1"
                  >
                    <Icon name="Plus" size={10} /> Agregar
                  </button>
                </div>
                
                <div className="space-y-3">
                  {formData.schedule.map((slot, index) => (
                    <div key={index} className="flex gap-2 items-center group">
                      <input 
                        value={slot.day} 
                        onChange={(e) => handleScheduleChange(index, 'day', e.target.value)} 
                        placeholder="Día (ej: Lunes)" 
                        className={`${inputClasses} w-1/3 px-3 py-2`} 
                      />
                      <input 
                        value={slot.time} 
                        onChange={(e) => handleScheduleChange(index, 'time', e.target.value)} 
                        placeholder="Ej: 08:00 - 09:00" 
                        className={`${inputClasses} flex-1 px-3 py-2`} 
                      />
                      {formData.schedule.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeScheduleSlot(index)} 
                          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                          title="Eliminar horario"
                        >
                          <Icon name="Trash2" size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Sección 3: Profesores */}
              <section>
                <div className="flex items-center justify-between pb-2 mb-5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-violet-50 text-violet-500 flex items-center justify-center">
                      <Icon name="Users" size={12} />
                    </div>
                    <h3 className="text-sm font-black text-slate-800">Profesores Asignados</h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={addProfessor}
                    className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md uppercase tracking-widest transition-colors flex items-center gap-1"
                  >
                    <Icon name="Plus" size={10} /> Agregar
                  </button>
                </div>
                
                <div className="space-y-3">
                  {formData.professors.map((prof, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <div className="w-5 h-5 rounded-full bg-violet-50 flex items-center justify-center flex-shrink-0">
                        <Icon name="User" size={10} className="text-violet-500" />
                      </div>
                      <input 
                        value={prof} 
                        onChange={(e) => handleProfessorChange(index, e.target.value)} 
                        placeholder="Nombre del profesor" 
                        className={`${inputClasses} flex-1 px-3 py-2`} 
                      />
                      {formData.professors.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeProfessor(index)} 
                          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                          title="Eliminar profesor"
                        >
                          <Icon name="Trash2" size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Sección 4: Características */}
              <section>
                <div className="flex items-center justify-between pb-2 mb-5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-amber-50 text-amber-500 flex items-center justify-center">
                      <Icon name="CheckCircle" size={12} />
                    </div>
                    <h3 className="text-sm font-black text-slate-800">Opciones / Variantes del Plan</h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={addFeature}
                    className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md uppercase tracking-widest transition-colors flex items-center gap-1"
                  >
                    <Icon name="Plus" size={10} /> Agregar
                  </button>
                </div>
                
                <div className="space-y-3">
                  {formData.features.map((feature, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Icon name="Check" size={12} className="text-emerald-500" />
                      </div>
                      <input 
                        value={feature} 
                        onChange={(e) => handleFeatureChange(index, e.target.value)} 
                        placeholder="Ej: Turno mañana, 3 días, etc." 
                        className={`${inputClasses} flex-1 px-3 py-2`} 
                      />
                      {formData.features.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeFeature(index)} 
                          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                          title="Eliminar opción"
                        >
                          <Icon name="Trash2" size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0 rounded-b-[2rem]">
          <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest">
            <Icon name="Info" size={12} />
            Obligatorio <span className="text-rose-500">*</span>
          </p>
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={onCancel} 
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200/50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              form="plan-form-standalone"
              type="submit" 
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5"
            >
              <Icon name="Save" size={16} />
              {plan ? 'Guardar Cambios' : 'Crear Plan'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PlanForm;