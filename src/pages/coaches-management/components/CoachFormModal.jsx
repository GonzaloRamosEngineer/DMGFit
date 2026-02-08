import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

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
      // Determinamos si es un email real o si debemos usar el fallback interno
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
          .eq('id', coachToEdit.profile_id); // Usar ID es más seguro que email

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
        alert("Profesor actualizado.");

      } else {
        // --- MODO CREACIÓN (FLUJO SINCRONIZADO) ---
        let profileId;

        if (!isInternal) {
          // 1. Registramos en Auth PRIMERO. 
          // Esto dispara el trigger SQL que crea el perfil automáticamente.
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: finalEmail,
            password: `tmp_${formData.dni.trim()}`,
            options: {
              data: {
                full_name: formData.fullName,
                role: 'profesor'
              }
            }
          });

          if (authError) throw authError;
          profileId = authData.user.id;

          // 2. PAUSA DE ESTABILIDAD: Esperamos 500ms para que el trigger termine 
          // de crear el perfil antes de intentar insertar en 'coaches'.
          await new Promise(resolve => setTimeout(resolve, 500));

        } else {
          // 3. Si NO hay email, creamos el perfil "fantasma" manualmente
          profileId = crypto.randomUUID();
          const { error: profileError } = await supabase.from('profiles').insert({
            id: profileId,
            full_name: formData.fullName,
            email: finalEmail,
            role: 'profesor'
          });
          if (profileError) throw profileError;
        }

        // 4. Insertamos la ficha técnica usando UPSERT (más seguro que insert)
        const { error: coachError } = await supabase.from('coaches').upsert({
          profile_id: profileId,
          specialization: formData.specialization || 'General',
          bio: formData.bio || '',
          phone: formData.phone
        });

        if (coachError) throw coachError;

        const msg = isInternal 
          ? "Registrado. Deberás habilitar su acceso con un correo real más adelante."
          : "Registrado y correo de confirmación enviado al profesor.";
        alert(msg);
      }

      onSuccess(); // Refrescar lista
      onClose();

    } catch (error) {
      console.error("Error en operación:", error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">
              {coachToEdit ? 'Editar Profesor' : 'Nuevo Profesor'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {coachToEdit ? 'Modificar datos existentes' : 'Alta de personal'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-smooth">
            <Icon name="X" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre Completo *" name="fullName" value={formData.fullName} onChange={handleChange} required />
            <div className="flex flex-col gap-1">
              <Input
                label="Email (opcional)"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required={!!coachToEdit}
              />
              {!coachToEdit && (
                <p className="text-[10px] text-primary font-medium px-1 italic">
                  Si no se ingresa, se asigna un email interno y la cuenta queda pendiente de habilitación.
                </p>
              )}
            </div>
            <Input label="DNI / ID" name="dni" value={formData.dni} onChange={handleChange} required disabled={!!coachToEdit} />
            <Input label="Teléfono" name="phone" value={formData.phone} onChange={handleChange} />
          </div>

          <Input label="Especialidad" name="specialization" value={formData.specialization} onChange={handleChange} />
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Biografía</label>
            <textarea 
              name="bio" 
              value={formData.bio} 
              onChange={handleChange} 
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="default" iconName={coachToEdit ? "Save" : "Check"} loading={loading}>
              {coachToEdit ? 'Guardar Cambios' : 'Registrar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CoachFormModal;