import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';
import { useToast } from '../../../hooks/useToast';

const CoachFormModal = ({ onClose, onSuccess, coachToEdit = null }) => {
  const { toast } = useToast();
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
      const dniDigits = formData.dni.trim().replace(/\D/g, '');
      const phone = (formData.phone || '').trim();
      // Email interno alineado al login por DNI: {DNI}@vcfit.internal
      // (mismo esquema que los atletas → entran con su DNI como usuario y clave).
      const isInternal = !normalizedEmail || normalizedEmail.includes('.internal');
      const finalEmail = isInternal
        ? `${dniDigits}@vcfit.internal`
        : normalizedEmail;

      if (coachToEdit) {
        // --- LÓGICA DE EDICIÓN ---
        // DNI y teléfono viven en profiles (que es donde el kiosco y el login los buscan).
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.fullName,
            email: finalEmail,
            dni: dniDigits || null,
            phone: phone || null,
          })
          .eq('id', coachToEdit.profileId); // <- Corrección: usando profileId que definimos en index.jsx

        if (profileError) throw profileError;

        const { error: coachError } = await supabase
          .from('coaches')
          .update({
            specialization: formData.specialization,
            bio: formData.bio,
            phone: phone
          })
          .eq('id', coachToEdit.id);

        if (coachError) throw coachError;

      } else {
        // --- CREACIÓN SIEMPRE COMO FANTASMA (Camino Seguro) ---
        const profileId = crypto.randomUUID();

        // 1. Insertamos en profiles (DNI + teléfono para kiosco/login)
        const { error: pErr } = await supabase.from('profiles').insert({
          id: profileId,
          full_name: formData.fullName,
          email: finalEmail,
          role: 'profesor',
          dni: dniDigits || null,
          phone: phone || null,
        });
        if (pErr) throw pErr;

        // 2. Insertamos la ficha técnica del profesor
        const { error: cErr } = await supabase.from('coaches').insert({
          profile_id: profileId,
          specialization: formData.specialization || 'General',
          bio: formData.bio || '',
          phone: phone
        });
        if (cErr) throw cErr;
      }

      onSuccess(); 
      onClose();   

    } catch (error) {
      console.error("Error en operación:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Clases Reutilizables
  const inputClasses = "w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 font-medium transition-all placeholder:text-text-tertiary";
  const labelClasses = "text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 mb-1.5 block";

  return (
    <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-modal flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">

      <div className="bg-card border border-border rounded-3xl w-full max-w-2xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-info-light text-primary flex items-center justify-center shadow-inner">
              <Icon name={coachToEdit ? "Edit" : "UserPlus"} size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-text-primary tracking-tight">
                {coachToEdit ? 'Editar Profesor' : 'Nuevo Profesor'}
              </h2>
              <p className="text-xs font-bold text-text-tertiary mt-0.5">
                {coachToEdit ? 'Modificar datos existentes' : 'Alta de personal en el sistema'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-text-tertiary hover:bg-muted hover:text-text-secondary transition-colors"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form id="coach-form" onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
          
          {/* Sección 1: Info Personal */}
          <section>
            <div className="flex items-center gap-2 pb-2 mb-4 border-b border-border">
              <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-500 flex items-center justify-center">
                <Icon name="User" size={12} />
              </div>
              <h3 className="text-sm font-black text-text-primary">Datos Personales</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className={labelClasses}>Nombre Completo <span className="text-error">*</span></label>
                <input name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Ej: Ana López" className={inputClasses} />
              </div>

              <div>
                <label className={labelClasses}>DNI / ID <span className="text-error">*</span></label>
                <input name="dni" value={formData.dni} onChange={handleChange} required placeholder="12345678" className={inputClasses} />
                <p className="text-[10px] text-text-tertiary mt-1 ml-1">Con este DNI el profe entra a la app y ficha en el kiosco.</p>
              </div>
              
              <div>
                <label className={labelClasses}>Teléfono</label>
                <input name="phone" value={formData.phone} onChange={handleChange} placeholder="+54 9..." className={inputClasses} />
              </div>
            </div>
          </section>

          {/* Sección 2: Info Profesional */}
          <section>
            <div className="flex items-center gap-2 pb-2 mb-4 border-b border-border">
              <div className="w-6 h-6 rounded bg-violet-50 text-violet-500 flex items-center justify-center">
                <Icon name="Award" size={12} />
              </div>
              <h3 className="text-sm font-black text-text-primary">Perfil Profesional</h3>
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
        <div className="px-6 py-4 bg-muted border-t border-border flex items-center justify-between shrink-0 rounded-b-3xl">
          <p className="text-[10px] font-bold text-text-tertiary flex items-center gap-1.5 uppercase tracking-widest">
            <Icon name="Info" size={12} />
            Obligatorio <span className="text-error">*</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-text-secondary hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              form="coach-form"
              type="submit"
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-primary-foreground bg-primary hover:bg-primary/90 shadow-md transition-all ${loading ? 'opacity-70 cursor-wait' : 'hover:-translate-y-0.5'}`}
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