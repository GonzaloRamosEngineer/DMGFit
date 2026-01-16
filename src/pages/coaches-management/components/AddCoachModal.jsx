import React, { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const AddCoachModal = ({ onClose, onCoachAdded }) => {
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    dni: '', // Será su usuario/pass inicial
    specialization: '',
    phone: '',
    bio: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Generar ID
      const newProfileId = crypto.randomUUID();

      // 2. Crear Perfil (Identidad con rol 'profesor')
      const { error: profileError } = await supabase.from('profiles').insert({
        id: newProfileId,
        full_name: formData.fullName,
        email: formData.email,
        role: 'profesor' // <--- CLAVE
      });

      if (profileError) throw profileError;

      // 3. Crear Ficha de Coach
      const { error: coachError } = await supabase.from('coaches').insert({
        profile_id: newProfileId,
        specialization: formData.specialization || 'General',
        bio: formData.bio || 'Entrenador apasionado'
        // Si tu tabla coaches tiene 'phone', agrégalo aquí. Si no, va en profiles.
      });

      if (coachError) throw coachError;

      alert(`¡Profesor registrado!\n\nUsuario: ${formData.email}\n(El usuario deberá registrarse/activar cuenta igual que el atleta)`);
      onCoachAdded();
      onClose();

    } catch (error) {
      console.error("Error registrando profesor:", error);
      alert("Error al registrar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl">
        
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Nuevo Profesor</h2>
            <p className="text-sm text-muted-foreground">Alta de personal</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-smooth">
            <Icon name="X" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre Completo *" name="fullName" value={formData.fullName} onChange={handleChange} required />
            <Input label="Email (Acceso) *" name="email" type="email" value={formData.email} onChange={handleChange} required />
            <Input label="DNI / ID" name="dni" value={formData.dni} onChange={handleChange} required />
            <Input label="Teléfono" name="phone" value={formData.phone} onChange={handleChange} />
          </div>

          <Input label="Especialidad (ej: CrossFit, Yoga)" name="specialization" value={formData.specialization} onChange={handleChange} placeholder="Preparación Física General" />
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Biografía Breve</label>
            <textarea 
              name="bio" 
              value={formData.bio} 
              onChange={handleChange} 
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary min-h-[80px]"
              placeholder="Experiencia, certificaciones..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="default" iconName="Check" loading={loading}>Guardar Profesor</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCoachModal;