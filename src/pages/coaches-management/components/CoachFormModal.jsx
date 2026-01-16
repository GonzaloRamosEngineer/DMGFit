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
        dni: coachToEdit.dni || '', // Ojo: a veces no traemos el DNI en la lista, asumimos que sí o lo dejamos vacío
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
      if (coachToEdit) {
        // --- MODO EDICIÓN ---
        // 1. Actualizar Perfil (Nombre, Email)
        // Nota: Cambiar el email aquí solo cambia el registro visual, no el login de Auth (eso es más complejo)
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            full_name: formData.fullName,
            email: formData.email 
          })
          .eq('email', coachToEdit.email); // Usamos el email original para buscar (o idealmente profile_id si lo tenemos)

        if (profileError) throw profileError;

        // 2. Actualizar Datos Coach
        const { error: coachError } = await supabase
          .from('coaches')
          .update({
            specialization: formData.specialization,
            bio: formData.bio,
            phone: formData.phone
          })
          .eq('id', coachToEdit.id);

        if (coachError) throw coachError;
        
        alert("Datos actualizados correctamente.");

      } else {
        // --- MODO CREACIÓN (El código que ya tenías) ---
        const newProfileId = crypto.randomUUID();

        const { error: profileError } = await supabase.from('profiles').insert({
          id: newProfileId,
          full_name: formData.fullName,
          email: formData.email,
          role: 'profesor'
        });
        if (profileError) throw profileError;

        const { error: coachError } = await supabase.from('coaches').insert({
          profile_id: newProfileId,
          specialization: formData.specialization || 'General',
          bio: formData.bio || '',
          phone: formData.phone
        });
        if (coachError) throw coachError;

        alert(`¡Profesor registrado!\nUsuario: ${formData.email}`);
      }

      onSuccess(); // Refrescar lista
      onClose();

    } catch (error) {
      console.error("Error:", error);
      alert("Error: " + error.message);
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
            <Input label="Email *" name="email" type="email" value={formData.email} onChange={handleChange} required />
            {/* El DNI suele ser fijo, lo deshabilitamos en edición para no romper logins */}
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