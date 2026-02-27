import React, { useMemo, useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { expandWindowsToSlots } from '../../../services/plans';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const defaultTiers = [1, 2, 3, 4, 5].map((v) => ({ visits_per_week: v, price: '' }));

const CreatePlanModal = ({ plan, professors, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    capacity: '',
    status: 'active',
    sessionDurationMin: 60,
    availabilityWindows: [{ day_of_week: 1, start_time: '09:00', end_time: '13:00', capacity: 10 }],
    pricingTiers: defaultTiers,
    professorIds: [],
    features: [''],
  });

  useEffect(() => {
    if (!plan) return;

    setFormData({
      ...plan,
      sessionDurationMin: Number(plan.sessionDurationMin || 60),
      availabilityWindows: plan.availabilityWindows?.length
        ? plan.availabilityWindows.map((window) => ({
            day_of_week: Number(window.day_of_week),
            start_time: String(window.start_time || '').slice(0, 5),
            end_time: String(window.end_time || '').slice(0, 5),
            capacity: Number(window.capacity || 0),
          }))
        : [{ day_of_week: 1, start_time: '09:00', end_time: '13:00', capacity: 10 }],
      pricingTiers: plan.pricingTiers?.length
        ? plan.pricingTiers.map((tier) => ({ visits_per_week: Number(tier.visits_per_week), price: Number(tier.price) }))
        : defaultTiers,
      features: plan.features?.length ? plan.features : [''],
      professorIds: plan.professorIds || [],
    });
  }, [plan]);

  const generatedSlots = useMemo(
    () => expandWindowsToSlots(formData.availabilityWindows, formData.sessionDurationMin),
    [formData.availabilityWindows, formData.sessionDurationMin]
  );

  const enabledDays = useMemo(
    () => Array.from(new Set(formData.availabilityWindows.map((window) => window.day_of_week))),
    [formData.availabilityWindows]
  );

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleDay = (day) => {
    setFormData((prev) => {
      const hasDay = prev.availabilityWindows.some((window) => window.day_of_week === day);
      if (hasDay) {
        const nextWindows = prev.availabilityWindows.filter((window) => window.day_of_week !== day);
        return {
          ...prev,
          availabilityWindows: nextWindows.length > 0 ? nextWindows : [{ day_of_week: 1, start_time: '09:00', end_time: '13:00', capacity: 10 }],
        };
      }

      return {
        ...prev,
        availabilityWindows: [...prev.availabilityWindows, { day_of_week: day, start_time: '09:00', end_time: '13:00', capacity: 10 }],
      };
    });
  };

  const addWindow = (dayOfWeek) => {
    setFormData((prev) => ({
      ...prev,
      availabilityWindows: [...prev.availabilityWindows, { day_of_week: dayOfWeek, start_time: '17:00', end_time: '21:00', capacity: 10 }],
    }));
  };

  const updateWindow = (index, field, value) => {
    setFormData((prev) => {
      const next = [...prev.availabilityWindows];
      next[index] = { ...next[index], [field]: field === 'day_of_week' || field === 'capacity' ? Number(value) : value };
      return { ...prev, availabilityWindows: next };
    });
  };

  const removeWindow = (index) => {
    setFormData((prev) => ({
      ...prev,
      availabilityWindows: prev.availabilityWindows.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const handleTierChange = (index, field, value) => {
    setFormData((prev) => {
      const next = [...prev.pricingTiers];
      next[index] = { ...next[index], [field]: Number(value) };
      return { ...prev, pricingTiers: next };
    });
  };

  const addTier = () => {
    setFormData((prev) => ({ ...prev, pricingTiers: [...prev.pricingTiers, { visits_per_week: 1, price: 0 }] }));
  };

  const removeTier = (index) => {
    setFormData((prev) => ({ ...prev, pricingTiers: prev.pricingTiers.filter((_, i) => i !== index) }));
  };

  const toggleProfessor = (profId) => {
    setFormData((prev) => ({
      ...prev,
      professorIds: prev.professorIds.includes(profId)
        ? prev.professorIds.filter((id) => id !== profId)
        : [...prev.professorIds, profId],
    }));
  };

  const handleFeatureChange = (index, value) => {
    setFormData((prev) => {
      const next = [...prev.features];
      next[index] = value;
      return { ...prev, features: next };
    });
  };

  const addFeature = () => setFormData((prev) => ({ ...prev, features: [...prev.features, ''] }));
  const removeFeature = (index) => setFormData((prev) => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));

  const handleSubmit = (event) => {
    event.preventDefault();

    const normalizedFeatures = Array.from(new Set(formData.features.map((feature) => feature.trim()).filter(Boolean)));
    const normalizedWindows = formData.availabilityWindows
      .map((window) => ({
        day_of_week: Number(window.day_of_week),
        start_time: String(window.start_time || '').slice(0, 5),
        end_time: String(window.end_time || '').slice(0, 5),
        capacity: Math.max(0, Number(window.capacity || 0)),
      }))
      .filter((window) => window.end_time > window.start_time);

    const normalizedPricing = Array.from(
      new Map(
        formData.pricingTiers
          .map((tier) => ({ visits_per_week: Number(tier.visits_per_week), price: Number(tier.price) }))
          .filter((tier) => tier.visits_per_week > 0 && Number.isFinite(tier.price))
          .map((tier) => [tier.visits_per_week, tier])
      ).values()
    ).sort((a, b) => a.visits_per_week - b.visits_per_week);

    onSave({
      ...formData,
      price: Number(formData.price),
      capacity: Number(formData.capacity),
      sessionDurationMin: Number(formData.sessionDurationMin || 60),
      features: normalizedFeatures,
      pricingTiers: normalizedPricing,
      availabilityWindows: normalizedWindows,
      scheduleSlots: expandWindowsToSlots(normalizedWindows, Number(formData.sessionDurationMin || 60)),
      schedule: expandWindowsToSlots(normalizedWindows, Number(formData.sessionDurationMin || 60)).map((slot) => ({
        day: DAYS[slot.day_of_week],
        time: `${slot.start_time} - ${slot.end_time}`,
      })),
    });
  };

  const inputClasses = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all placeholder:text-slate-400';
  const labelClasses = 'text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white border border-slate-100 rounded-[2rem] w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
              <Icon name={plan ? 'Edit' : 'PlusCircle'} size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">{plan ? 'Editar Plan' : 'Crear Nuevo Plan'}</h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5">Define disponibilidad semanal, cupos y precios por visitas.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        <form id="plan-form" onSubmit={handleSubmit} className="overflow-y-auto p-6 custom-scrollbar flex-1 space-y-8">
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Nombre del Plan *</label>
              <input name="name" value={formData.name} onChange={handleInputChange} className={inputClasses} required />
            </div>
            <div>
              <label className={labelClasses}>Estado</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className={`${inputClasses} appearance-none`}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className={labelClasses}>Descripción *</label>
              <textarea name="description" value={formData.description} onChange={handleInputChange} rows={2} className={`${inputClasses} resize-none`} required />
            </div>
            <div>
              <label className={labelClasses}>Precio base legacy (opcional)</label>
              <input name="price" type="number" value={formData.price} onChange={handleInputChange} className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>Duración de sesión (min) *</label>
              <input name="sessionDurationMin" type="number" min="15" step="15" value={formData.sessionDurationMin} onChange={handleInputChange} className={inputClasses} required />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-black text-slate-800 mb-3">Días habilitados</h3>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day, index) => (
                <button key={day} type="button" onClick={() => toggleDay(index)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${enabledDays.includes(index) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                  {day}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-800">Rangos horarios por día + cupo</h3>
            </div>
            <div className="space-y-2">
              {formData.availabilityWindows.map((window, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <select value={window.day_of_week} onChange={(e) => updateWindow(index, 'day_of_week', e.target.value)} className={`${inputClasses} col-span-3 px-3 py-2`}>
                    {DAYS.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}
                  </select>
                  <input type="time" value={window.start_time} onChange={(e) => updateWindow(index, 'start_time', e.target.value)} className={`${inputClasses} col-span-3 px-3 py-2`} />
                  <input type="time" value={window.end_time} onChange={(e) => updateWindow(index, 'end_time', e.target.value)} className={`${inputClasses} col-span-3 px-3 py-2`} />
                  <input type="number" min="0" value={window.capacity} onChange={(e) => updateWindow(index, 'capacity', e.target.value)} className={`${inputClasses} col-span-2 px-2 py-2`} placeholder="Cupo" />
                  <button type="button" onClick={() => removeWindow(index)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                    <Icon name="Trash2" size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {enabledDays.map((day) => (
                <button key={day} type="button" onClick={() => addWindow(day)} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md uppercase tracking-widest transition-colors flex items-center gap-1">
                  <Icon name="Plus" size={10} /> Agregar ventana {DAYS[day]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-black text-slate-800 mb-3">Vista previa de slots generados ({generatedSlots.length})</h3>
            <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
              {generatedSlots.length === 0 ? <p className="text-xs text-slate-400">Sin slots válidos.</p> : generatedSlots.map((slot, idx) => (
                <p key={`${slot.day_of_week}-${slot.start_time}-${idx}`} className="text-xs font-semibold text-slate-600">
                  {DAYS[slot.day_of_week]} {slot.start_time}-{slot.end_time} (cupo {slot.capacity})
                </p>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-800">Precios por visitas/semana</h3>
              <button type="button" onClick={addTier} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md uppercase tracking-widest transition-colors flex items-center gap-1"><Icon name="Plus" size={10} /> Agregar</button>
            </div>
            <div className="space-y-2">
              {formData.pricingTiers.map((tier, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <input type="number" min="1" max="7" value={tier.visits_per_week} onChange={(e) => handleTierChange(index, 'visits_per_week', e.target.value)} className={`${inputClasses} col-span-4 px-3 py-2`} />
                  <input type="number" min="0" value={tier.price} onChange={(e) => handleTierChange(index, 'price', e.target.value)} className={`${inputClasses} col-span-7 px-3 py-2`} />
                  {formData.pricingTiers.length > 1 && <button type="button" onClick={() => removeTier(index)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Icon name="Trash2" size={16} /></button>}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-black text-slate-800 mb-3">Opciones / Variantes del Plan</h3>
            <div className="space-y-2">
              {formData.features.map((feature, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input value={feature} onChange={(e) => handleFeatureChange(index, e.target.value)} placeholder="Ej: Turno mañana, 3 días, etc." className={`${inputClasses} flex-1 px-3 py-2`} />
                  {formData.features.length > 1 && <button type="button" onClick={() => removeFeature(index)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Icon name="Trash2" size={16} /></button>}
                </div>
              ))}
            </div>
            <button type="button" onClick={addFeature} className="mt-3 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md uppercase tracking-widest transition-colors flex items-center gap-1"><Icon name="Plus" size={10} /> Agregar opción</button>
          </section>

          <section>
            <h3 className="text-sm font-black text-slate-800 mb-3">Profesores asignados</h3>
            <div className="flex flex-wrap gap-2">
              {professors.length > 0 ? professors.map((prof) => {
                const isSelected = formData.professorIds.includes(prof.id);
                return <button key={prof.id} type="button" onClick={() => toggleProfessor(prof.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${isSelected ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{prof.name}</button>;
              }) : <p className="text-sm text-slate-400 font-medium">No hay profesores registrados.</p>}
            </div>
          </section>
        </form>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0 rounded-b-[2rem]">
          <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest"><Icon name="Info" size={12} /> Obligatorio <span className="text-rose-500">*</span></p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200/50 transition-colors">Cancelar</button>
            <button form="plan-form" type="submit" className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5">
              <Icon name="Save" size={16} />{plan ? 'Guardar Cambios' : 'Crear Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePlanModal;
