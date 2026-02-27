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

  // Clases Reutilizables estilo SaaS
  const inputClasses = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 font-medium transition-all placeholder:text-slate-400";
  const labelClasses = "text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-2 block";
  const sectionCardClasses = "bg-white border border-slate-100 rounded-[1.5rem] p-6 shadow-sm";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div className="bg-slate-50 border border-slate-200 rounded-[2rem] w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
        
        {/* Header */}
        <div className="px-8 py-6 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/50">
              <Icon name={plan ? "Edit" : "PlusCircle"} size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                {plan ? 'Editar Plan' : 'Crear Nuevo Plan'}
              </h2>
              <p className="text-sm font-medium text-slate-400 mt-0.5">
                Configura los detalles comerciales y operativos
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Formulario con Scroll Vertical */}
        <form id="plan-form" onSubmit={handleSubmit} className="overflow-y-auto p-4 md:p-8 custom-scrollbar flex-1 space-y-8">
          
          {/* SECCIÓN 1: IDENTIDAD DEL PLAN */}
          <div className={sectionCardClasses}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Icon name="FileText" size={16} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Identidad del Plan</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-8">
                <label className={labelClasses}>Nombre Comercial <span className="text-rose-500">*</span></label>
                <input name="name" value={formData.name} onChange={handleInputChange} placeholder="Ej: Plan Elite Crossfit" required className={inputClasses} autoFocus />
              </div>
              <div className="md:col-span-4">
                <label className={labelClasses}>Estado</label>
                <select name="status" value={formData.status} onChange={handleInputChange} className={`${inputClasses} appearance-none cursor-pointer`}>
                  <option value="active">🟢 Activo (Visible)</option>
                  <option value="inactive">🔴 Inactivo (Oculto)</option>
                </select>
              </div>
              <div className="md:col-span-12">
                <label className={labelClasses}>Descripción <span className="text-rose-500">*</span></label>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleInputChange} 
                  placeholder="Describe los beneficios principales de este plan..." 
                  rows={2} 
                  className={`${inputClasses} resize-none`} 
                  required 
                />
              </div>
            </div>
          </div>

          {/* GRID DE 2 COLUMNAS PARA PRECIOS Y PROFESORES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* SECCIÓN 2: VALORES BASE */}
            <div className={`${sectionCardClasses} flex flex-col`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Icon name="DollarSign" size={16} />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Valores Base</h3>
              </div>
              
              <div className="space-y-6 flex-1">
                <div>
                  <label className={labelClasses}>Precio Mensual Referencia <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">$</span>
                    <input name="price" type="number" value={formData.price} onChange={handleInputChange} placeholder="0.00" required className={`${inputClasses} pl-9 text-lg font-bold`} />
                  </div>
                </div>
                <div>
                  <label className={labelClasses}>Capacidad Máxima General <span className="text-rose-500">*</span></label>
                  <input name="capacity" type="number" value={formData.capacity} onChange={handleInputChange} placeholder="Ej: 25 atletas" required className={inputClasses} />
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: PROFESORES */}
            <div className={`${sectionCardClasses} flex flex-col`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                  <Icon name="Users" size={16} />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Profesores a Cargo</h3>
              </div>
              
              <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-100 max-h-[180px] overflow-y-auto custom-scrollbar">
                <div className="flex flex-wrap gap-2">
                  {professors.length > 0 ? professors.map((prof) => {
                    const isSelected = formData.professorIds.includes(prof.id);
                    return (
                      <button
                        key={prof.id}
                        type="button"
                        onClick={() => toggleProfessor(prof.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border ${
                          isSelected
                            ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50'
                        }`}
                      >
                        {isSelected && <Icon name="Check" size={12} />}
                        {prof.name}
                      </button>
                    );
                  }) : <p className="text-sm text-slate-400 font-medium py-4 text-center w-full">No hay profesores registrados.</p>}
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: HORARIOS Y CUPOS */}
          <div className={sectionCardClasses}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Icon name="Calendar" size={16} />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Grilla de Horarios</h3>
              </div>
              <button type="button" onClick={addScheduleSlot} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                <Icon name="Plus" size={14} /> Nueva Ventana
              </button>
            </div>
            
            <div className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
              
              {/* Header de Tabla (Ajustado para darle más espacio al Cupo) */}
              <div className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-slate-200 bg-slate-100/50 hidden md:grid">
                <div className="col-span-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Día</div>
                <div className="col-span-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Inicio</div>
                <div className="col-span-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fin</div>
                <div className="col-span-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Cupo</div>
                <div className="col-span-1"></div>
              </div>

              {/* Filas de la Grilla */}
              <div className="p-3 space-y-3">
                {formData.scheduleSlots.map((slot, index) => (
                  <div key={index} className="grid grid-cols-2 md:grid-cols-12 gap-3 items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm transition-all hover:border-blue-200">
                    
                    {/* Día */}
                    <div className="col-span-2 md:col-span-3">
                      <select value={slot.day_of_week} onChange={(e) => handleScheduleSlotChange(index, 'day_of_week', e.target.value)} className={inputClasses}>
                        {days.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}
                      </select>
                    </div>
                    
                    {/* Inicio */}
                    <div className="col-span-1 md:col-span-3">
                      <input type="time" value={slot.start_time} onChange={(e) => handleScheduleSlotChange(index, 'start_time', e.target.value)} className={inputClasses} />
                    </div>
                    
                    {/* Fin */}
                    <div className="col-span-1 md:col-span-3">
                      <input type="time" value={slot.end_time} onChange={(e) => handleScheduleSlotChange(index, 'end_time', e.target.value)} className={inputClasses} />
                    </div>
                    
                    {/* Cupo (Ahora tiene el doble de espacio) */}
                    <div className="col-span-1 md:col-span-2">
                      <input 
                        type="number" 
                        min="0" 
                        value={slot.capacity} 
                        onChange={(e) => handleScheduleSlotChange(index, 'capacity', e.target.value)} 
                        placeholder="0" 
                        className={`${inputClasses} text-center px-2 font-bold text-blue-600`} 
                      />
                    </div>
                    
                    {/* Borrar */}
                    <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center">
                      <button type="button" onClick={() => removeScheduleSlot(index)} className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                        <Icon name="Trash2" size={18} />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GRID DE 2 COLUMNAS PARA PRECIOS ESCALONADOS Y FEATURES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* SECCIÓN 5: PRECIOS ESCALONADOS */}
            <div className={sectionCardClasses}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
                    <Icon name="Layers" size={16} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">Precios Escalonados</h3>
                </div>
                <button type="button" onClick={addPricingTier} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                  <Icon name="Plus" size={12} /> Añadir
                </button>
              </div>
              
              <div className="space-y-3">
                {formData.pricingTiers.map((tier, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <div className="relative w-1/3">
                      <input type="number" min="1" max="7" value={tier.visits_per_week} onChange={(e) => handleTierChange(index, 'visits_per_week', e.target.value)} className={`${inputClasses} pr-8`} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Días</span>
                    </div>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                      <input type="number" min="0" value={tier.price} onChange={(e) => handleTierChange(index, 'price', e.target.value)} className={`${inputClasses} pl-8`} placeholder="Precio" />
                    </div>
                    {formData.pricingTiers.length > 1 && (
                      <button type="button" onClick={() => removePricingTier(index)} className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors shrink-0">
                        <Icon name="Trash2" size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN 6: CARACTERÍSTICAS */}
            <div className={sectionCardClasses}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
                    <Icon name="List" size={16} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">¿Qué incluye?</h3>
                </div>
                <button type="button" onClick={addFeature} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                  <Icon name="Plus" size={12} /> Añadir
                </button>
              </div>
              
              <div className="space-y-3">
                {formData.features.map((feature, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <Icon name="Check" size={14} className="text-emerald-500" />
                    </div>
                    <input 
                      value={feature} 
                      onChange={(e) => handleFeatureChange(index, e.target.value)} 
                      placeholder="Ej: Acceso a duchas" 
                      className={`${inputClasses} flex-1`} 
                    />
                    {formData.features.length > 1 && (
                      <button type="button" onClick={() => removeFeature(index)} className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors shrink-0">
                        <Icon name="X" size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="px-8 py-5 bg-white border-t border-slate-100 flex items-center justify-between shrink-0 z-10">
          <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest">
            <Icon name="Info" size={14} />
            Campos obligatorios <span className="text-rose-500 text-lg leading-none">*</span>
          </p>
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-6 py-3 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button 
              form="plan-form"
              type="submit" 
              className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all hover:-translate-y-0.5"
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