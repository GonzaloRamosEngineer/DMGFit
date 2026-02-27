import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';

const CreatePlanModal = ({ plan, professors, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    capacity: '',
    status: 'active',
    schedule: [],
    scheduleSlots: [{ day_of_week: 1, start_time: '', end_time: '', capacity: 0 }],
    pricingTiers: [
      { visits_per_week: 1, price: '' },
      { visits_per_week: 2, price: '' },
      { visits_per_week: 3, price: '' },
      { visits_per_week: 4, price: '' },
      { visits_per_week: 5, price: '' },
    ],
    professorIds: [], 
    features: ['']
  });

  useEffect(() => {
    if (plan) {
      setFormData({
        ...plan,
        schedule: plan.schedule?.length ? plan.schedule : [],
        scheduleSlots: plan.schedule?.length
          ? plan.schedule
              .filter((slot) => slot.day_of_week !== undefined)
              .map((slot) => ({
                day_of_week: Number(slot.day_of_week),
                start_time: String(slot.start_time || slot.time?.split(' - ')[0] || ''),
                end_time: String(slot.end_time || slot.time?.split(' - ')[1] || ''),
                capacity: Number(slot.capacity || 0),
              }))
          : [{ day_of_week: 1, start_time: '', end_time: '', capacity: 0 }],
        pricingTiers: plan.pricingTiers?.length
          ? plan.pricingTiers.map((tier) => ({
              visits_per_week: Number(tier.visits_per_week),
              price: Number(tier.price),
            }))
          : [
              { visits_per_week: 1, price: '' },
              { visits_per_week: 2, price: '' },
              { visits_per_week: 3, price: '' },
              { visits_per_week: 4, price: '' },
              { visits_per_week: 5, price: '' },
            ],
        features: plan.features?.length ? plan.features : [''],
        professorIds: plan.professorIds || []
      });
    }
  }, [plan]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleScheduleSlotChange = (index, field, value) => {
    const next = [...formData.scheduleSlots];
    next[index] = {
      ...next[index],
      [field]: field === 'day_of_week' || field === 'capacity' ? Number(value) : value,
    };
    setFormData((prev) => ({ ...prev, scheduleSlots: next }));
  };

  const addScheduleSlot = () => {
    setFormData((prev) => ({
      ...prev,
      scheduleSlots: [...prev.scheduleSlots, { day_of_week: 1, start_time: '', end_time: '', capacity: 0 }],
    }));
  };

  const removeScheduleSlot = (index) => {
    setFormData((prev) => ({
      ...prev,
      scheduleSlots: prev.scheduleSlots.filter((_, i) => i !== index),
    }));
  };

  const handleTierChange = (index, field, value) => {
    const next = [...formData.pricingTiers];
    next[index] = {
      ...next[index],
      [field]: field === 'visits_per_week' || field === 'price' ? Number(value) : value,
    };
    setFormData((prev) => ({ ...prev, pricingTiers: next }));
  };

  const addPricingTier = () => {
    setFormData((prev) => ({
      ...prev,
      pricingTiers: [...prev.pricingTiers, { visits_per_week: 1, price: '' }],
    }));
  };

  const removePricingTier = (index) => {
    setFormData((prev) => ({
      ...prev,
      pricingTiers: prev.pricingTiers.filter((_, i) => i !== index),
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

    const normalizedFeatures = Array.from(
      new Set(
        formData.features
          .map((feature) => feature.trim())
          .filter((feature) => feature !== '')
      )
    );

    const normalizedScheduleSlots = formData.scheduleSlots
      .map((slot) => ({
        day_of_week: Number(slot.day_of_week),
        start_time: String(slot.start_time || '').slice(0, 5),
        end_time: String(slot.end_time || '').slice(0, 5),
        capacity: Number(slot.capacity || 0),
      }))
      .filter((slot) => slot.start_time && slot.end_time);

    const normalizedPricingTiers = Array.from(
      new Map(
        formData.pricingTiers
          .map((tier) => ({
            visits_per_week: Number(tier.visits_per_week),
            price: Number(tier.price),
          }))
          .filter((tier) => tier.visits_per_week > 0 && Number.isFinite(tier.price))
          .map((tier) => [tier.visits_per_week, tier])
      ).values()
    ).sort((a, b) => a.visits_per_week - b.visits_per_week);

    onSave({
      ...formData,
      price: Number(formData.price),
      capacity: Number(formData.capacity),
      features: normalizedFeatures,
      pricingTiers: normalizedPricingTiers,
      scheduleSlots: normalizedScheduleSlots,
      schedule: normalizedScheduleSlots.map((slot) => ({
        day: days[slot.day_of_week] || 'Día',
        time: `${slot.start_time} - ${slot.end_time}`,
      })),
    });
  };

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Clases Reutilizables
  const inputClasses = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all placeholder:text-slate-400";
  const labelClasses = "text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      
      {/* Modal Container: Max width grande para permitir 2 columnas cómodas */}
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
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Formulario con Scroll (GRID 2 Columnas) */}
        <form id="plan-form" onSubmit={handleSubmit} className="overflow-y-auto p-6 custom-scrollbar flex-1">
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
                      <option value="active">Activo (Visible)</option>
                      <option value="inactive">Inactivo (Oculto)</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Sección 2: Profesores */}
              <section>
                <div className="flex items-center gap-2 pb-2 mb-5 border-b border-slate-100">
                  <div className="w-6 h-6 rounded bg-violet-50 text-violet-500 flex items-center justify-center">
                    <Icon name="Users" size={12} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">Profesores Asignados</h3>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {professors.length > 0 ? professors.map((prof) => {
                    const isSelected = formData.professorIds.includes(prof.id);
                    return (
                      <button
                        key={prof.id}
                        type="button"
                        onClick={() => toggleProfessor(prof.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border ${
                          isSelected
                            ? 'bg-violet-50 text-violet-700 border-violet-200'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-violet-500' : 'bg-slate-300'}`}></div>
                        {prof.name}
                      </button>
                    );
                  }) : <p className="text-sm text-slate-400 font-medium">No hay profesores registrados.</p>}
                </div>
              </section>

            </div>

            {/* --- COLUMNA DERECHA --- */}
            <div className="space-y-8">
              
              {/* Sección 3: Horarios y Cupos */}
              <section>
                <div className="flex items-center justify-between pb-2 mb-5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-500 flex items-center justify-center">
                      <Icon name="Clock" size={12} />
                    </div>
                    <h3 className="text-sm font-black text-slate-800">Días / Ventanas / Cupos</h3>
                  </div>
                  <button type="button" onClick={addScheduleSlot} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md uppercase tracking-widest transition-colors flex items-center gap-1">
                    <Icon name="Plus" size={10} /> Agregar
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.scheduleSlots.map((slot, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <select value={slot.day_of_week} onChange={(e) => handleScheduleSlotChange(index, 'day_of_week', e.target.value)} className={`${inputClasses} col-span-4 px-3 py-2`}>
                        {days.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}
                      </select>
                      <input type="time" value={slot.start_time} onChange={(e) => handleScheduleSlotChange(index, 'start_time', e.target.value)} className={`${inputClasses} col-span-3 px-3 py-2`} />
                      <input type="time" value={slot.end_time} onChange={(e) => handleScheduleSlotChange(index, 'end_time', e.target.value)} className={`${inputClasses} col-span-3 px-3 py-2`} />
                      <input type="number" min="0" value={slot.capacity} onChange={(e) => handleScheduleSlotChange(index, 'capacity', e.target.value)} placeholder="Cupo" className={`${inputClasses} col-span-1 px-2 py-2 text-center`} />
                      <button type="button" onClick={() => removeScheduleSlot(index)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar ventana">
                        <Icon name="Trash2" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Sección 4: Precios por Semana */}
              <section>
                <div className="flex items-center justify-between pb-2 mb-5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-cyan-50 text-cyan-500 flex items-center justify-center">
                      <Icon name="DollarSign" size={12} />
                    </div>
                    <h3 className="text-sm font-black text-slate-800">Precios por Semana</h3>
                  </div>
                  <button type="button" onClick={addPricingTier} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md uppercase tracking-widest transition-colors flex items-center gap-1">
                    <Icon name="Plus" size={10} /> Agregar
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.pricingTiers.map((tier, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <input type="number" min="1" max="7" value={tier.visits_per_week} onChange={(e) => handleTierChange(index, 'visits_per_week', e.target.value)} className={`${inputClasses} col-span-4 px-3 py-2`} />
                      <input type="number" min="0" value={tier.price} onChange={(e) => handleTierChange(index, 'price', e.target.value)} className={`${inputClasses} col-span-7 px-3 py-2`} placeholder="Precio" />
                      {formData.pricingTiers.length > 1 && (
                        <button type="button" onClick={() => removePricingTier(index)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar precio">
                          <Icon name="Trash2" size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Sección 5: Características */}
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
                
                <div className="space-y-2">
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
              onClick={onClose} 
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200/50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              form="plan-form"
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

export default CreatePlanModal;