import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';

const CoachFormModal = ({ onClose, onSuccess, coachToEdit = null }) => {
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    dni: '',
    specialization: '',
    phone: '',
    bio: ''
  });

  // Si estamos editando, cargamos los datos al abrir
  useEffect(() => {
    if (coachToEdit) {
      setFormData({
        fullName: coachToEdit.name || '',
        email: coachToEdit.email || '',
        dni: coachToEdit.dni || '',
        specialization: coachToEdit.specialization || '',
        phone: coachToEdit.phone || '',
        bio: coachToEdit.bio || ''
      });
    }
  }, [coachToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = formData.email.trim();
      // Generamos el email interno basado en DNI para consistencia
      const isInternal = !normalizedEmail || normalizedEmail.includes('.internal');
      const finalEmail = isInternal 
        ? `sin_email_${formData.dni.trim().replace(/\D/g, '')}@dmg.internal`
        : normalizedEmail;

      if (coachToEdit) {
        // --- LÓGICA DE EDICIÓN ---
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            full_name: formData.fullName, 
            email: normalizedEmail 
          })
          .eq('id', coachToEdit.profileId); // <- Corrección: usando profileId que definimos en index.jsx

        if (profileError) throw profileError;

        const { error: coachError } = await supabase
          .from('coaches')
          .update({
            specialization: formData.specialization,
            bio: formData.bio,
            phone: formData.phone
          })
          .eq('id', coachToEdit.id);

        if (coachError) throw coachError;
        
      } else {
        // --- CREACIÓN SIEMPRE COMO FANTASMA (Camino Seguro) ---
        const profileId = crypto.randomUUID();
        
        // 1. Insertamos en profiles
        const { error: pErr } = await supabase.from('profiles').insert({
          id: profileId, 
          full_name: formData.fullName, 
          email: finalEmail, 
          role: 'profesor'
        });
        if (pErr) throw pErr;

        // 2. Insertamos la ficha técnica del profesor
        const { error: cErr } = await supabase.from('coaches').insert({
          profile_id: profileId, 
          specialization: formData.specialization || 'General',
          bio: formData.bio || '', 
          phone: formData.phone
        });
        if (cErr) throw cErr;
      }

      onSuccess(); 
      onClose();   

    } catch (error) {
      console.error("Error en operación:", error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Clases Reutilizables
  const inputClasses = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all placeholder:text-slate-400";
  const labelClasses = "text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      
      <div className="bg-white border border-slate-100 rounded-[2rem] w-full max-w-2xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
              <Icon name={coachToEdit ? "Edit" : "UserPlus"} size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                {coachToEdit ? 'Editar Profesor' : 'Nuevo Profesor'}
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5">
                {coachToEdit ? 'Modificar datos existentes' : 'Alta de personal en el sistema'}
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

        {/* Formulario */}
        <form id="coach-form" onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
          
          {/* Sección 1: Info Personal */}
          <section>
            <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
              <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-500 flex items-center justify-center">
                <Icon name="User" size={12} />
              </div>
              <h3 className="text-sm font-black text-slate-800">Datos Personales</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className={labelClasses}>Nombre Completo <span className="text-rose-500">*</span></label>
                <input name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Ej: Ana López" className={inputClasses} />
              </div>
              
              <div>
                <label className={labelClasses}>DNI / ID <span className="text-rose-500">*</span></label>
                <input name="dni" value={formData.dni} onChange={handleChange} required disabled={!!coachToEdit} placeholder="12345678" className={`${inputClasses} ${coachToEdit ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`} />
              </div>
              
              <div>
                <label className={labelClasses}>Teléfono</label>
                <input name="phone" value={formData.phone} onChange={handleChange} placeholder="+54 9..." className={inputClasses} />
              </div>
            </div>
          </section>

          {/* Sección 2: Info Profesional */}
          <section>
            <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
              <div className="w-6 h-6 rounded bg-violet-50 text-violet-500 flex items-center justify-center">
                <Icon name="Award" size={12} />
              </div>
              <h3 className="text-sm font-black text-slate-800">Perfil Profesional</h3>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className={labelClasses}>Especialidad</label>
                <input name="specialization" value={formData.specialization} onChange={handleChange} placeholder="Ej: Musculación, Crossfit, Yoga..." className={inputClasses} />
              </div>
              
              <div>
                <label className={labelClasses}>Biografía / Presentación</label>
                <textarea 
                  name="bio" 
                  value={formData.bio} 
                  onChange={handleChange} 
                  placeholder="Una breve descripción sobre la experiencia y estilo del entrenador..."
                  rows={3}
                  className={`${inputClasses} resize-none`}
                />
              </div>
            </div>
          </section>

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
              form="coach-form"
              type="submit" 
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all ${loading ? 'opacity-70 cursor-wait' : 'hover:-translate-y-0.5'}`}
            >
              {loading ? (
                <><Icon name="Loader" size={16} className="animate-spin" /> Procesando...</>
              ) : (
                <><Icon name={coachToEdit ? "Save" : "Check"} size={16} /> {coachToEdit ? 'Guardar Cambios' : 'Registrar'}</>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CoachFormModal;