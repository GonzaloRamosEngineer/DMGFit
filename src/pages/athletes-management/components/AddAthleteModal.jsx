import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const AddAthleteModal = ({ onClose, onAthleteAdded }) => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [coaches, setCoaches] = useState([]);
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    // Identidad
    fullName: '',
    email: '',
    dni: '',
    
    // Ficha Técnica
    birthDate: '',
    gender: 'select',
    phone: '',
    address: '',
    city: '',
    
    // Emergencia
    emergencyName: '',
    emergencyPhone: '',
    medicalConditions: '',
    
    // Membresía
    planId: '',
    coachId: '',
    joinDate: new Date().toISOString().split('T')[0],
    amount: '' // Se autocalcula
  });

  // 1. Cargar Planes y Coaches al abrir el modal
  useEffect(() => {
    const fetchResources = async () => {
      try {
        const [plansRes, coachesRes] = await Promise.all([
          supabase.from('plans').select('id, name, price').eq('status', 'active'),
          supabase.from('coaches').select('id, profiles:profile_id(full_name)')
        ]);

        if (plansRes.data) setPlans(plansRes.data);
        if (coachesRes.data) {
          // Formateamos para el select
          setCoaches(coachesRes.data.map(c => ({
            id: c.id,
            name: c.profiles?.full_name || 'Coach'
          })));
        }
      } catch (error) {
        console.error("Error cargando recursos:", error);
      }
    };
    fetchResources();
  }, []);

  // 2. Manejo de cambios
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Si cambia el plan, actualizamos el precio automáticamente
    if (name === 'planId') {
      const selectedPlan = plans.find(p => p.id === value);
      if (selectedPlan) {
        setFormData(prev => ({ ...prev, planId: value, amount: selectedPlan.price }));
      }
    }
  };

  // 3. Guardar Atleta (La magia)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // A) Crear Usuario Simulado en Perfiles (Identidad)
      // Nota: En un sistema Auth real, aquí llamaríamos a una Edge Function para crear el usuario.
      // Por ahora, insertamos el perfil manualmente para que el sistema funcione.
      const newProfileId = crypto.randomUUID();
      
      const { error: profileError } = await supabase.from('profiles').insert({
        id: newProfileId,
        full_name: formData.fullName,
        email: formData.email,
        role: 'atleta'
      });

      if (profileError) throw profileError;

      // B) Crear Ficha de Atleta
      const { data: newAthlete, error: athleteError } = await supabase.from('athletes').insert({
        profile_id: newProfileId,
        dni: formData.dni,
        birth_date: formData.birthDate || null,
        gender: formData.gender !== 'select' ? formData.gender : null,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        emergency_contact_name: formData.emergencyName,
        emergency_contact_phone: formData.emergencyPhone,
        medical_conditions: formData.medicalConditions,
        coach_id: formData.coachId || null,
        status: 'active',
        join_date: formData.joinDate
        // plan_id se manejaría si tuviéramos tabla intermedia, aquí asumimos gestión por pagos
      }).select().single();

      if (athleteError) throw athleteError;

      // C) Generar Deuda Inicial (Pago Pendiente)
      if (formData.planId) {
        const { error: paymentError } = await supabase.from('payments').insert({
          athlete_id: newAthlete.id,
          amount: formData.amount,
          status: 'pending', // Nace con deuda
          payment_date: formData.joinDate,
          method: 'efectivo', // Default
          concept: `Inscripción - ${plans.find(p => p.id === formData.planId)?.name}`
        });
        if (paymentError) console.error("Error creando pago inicial", paymentError);
      }

      onAthleteAdded(); // Refrescar lista padre
      onClose(); // Cerrar modal

    } catch (error) {
      console.error("Error registrando atleta:", error);
      alert("Error al registrar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-heading font-bold text-foreground">Nuevo Atleta</h2>
            <p className="text-sm text-muted-foreground">Complete la ficha para dar de alta</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-smooth">
            <Icon name="X" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          
          {/* Sección 1: Identidad */}
          <div>
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Icon name="User" size={16} /> Identidad y Acceso
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Nombre Completo *" 
                name="fullName" 
                value={formData.fullName} 
                onChange={handleChange} 
                required 
              />
              <Input 
                label="Email (Usuario) *" 
                name="email" 
                type="email" 
                value={formData.email} 
                onChange={handleChange} 
                required 
              />
              <Input 
                label="DNI (Contraseña Inicial) *" 
                name="dni" 
                value={formData.dni} 
                onChange={handleChange} 
                required 
                placeholder="Sin puntos"
              />
              <Input 
                label="Teléfono" 
                name="phone" 
                value={formData.phone} 
                onChange={handleChange} 
              />
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Sección 2: Datos Personales */}
          <div>
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Icon name="FileText" size={16} /> Ficha Técnica
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input 
                label="Fecha de Nacimiento" 
                name="birthDate" 
                type="date" 
                value={formData.birthDate} 
                onChange={handleChange} 
              />
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Género</label>
                <select 
                  name="gender" 
                  value={formData.gender} 
                  onChange={handleChange}
                  className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="select" disabled>Seleccionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="X">Otro</option>
                </select>
              </div>

              <Input label="Ciudad/Barrio" name="city" value={formData.city} onChange={handleChange} />
              
              <div className="md:col-span-3">
                <Input label="Dirección" name="address" value={formData.address} onChange={handleChange} />
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Sección 3: Salud y Emergencia */}
          <div>
            <h3 className="text-sm font-semibold text-error uppercase tracking-wider mb-4 flex items-center gap-2">
              <Icon name="Heart" size={16} /> Salud y Emergencia
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Contacto de Emergencia (Nombre)" name="emergencyName" value={formData.emergencyName} onChange={handleChange} />
              <Input label="Teléfono de Emergencia" name="emergencyPhone" value={formData.emergencyPhone} onChange={handleChange} />
              <div className="md:col-span-2">
                <Input label="Condiciones Médicas / Lesiones" name="medicalConditions" value={formData.medicalConditions} onChange={handleChange} placeholder="Apto físico, alergias, operaciones..." />
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Sección 4: Membresía */}
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Icon name="CreditCard" size={16} /> Membresía Inicial
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Plan Seleccionado *</label>
                <select 
                  name="planId" 
                  value={formData.planId} 
                  onChange={handleChange}
                  className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                  required
                >
                  <option value="" disabled>Seleccionar Plan...</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Coach Asignado</label>
                <select 
                  name="coachId" 
                  value={formData.coachId} 
                  onChange={handleChange}
                  className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="">Sin Coach (Opcional)</option>
                  {coaches.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <Input 
                label="Fecha de Inicio" 
                name="joinDate" 
                type="date" 
                value={formData.joinDate} 
                onChange={handleChange} 
              />
              
              <Input 
                label="Monto Inicial (Deuda)" 
                name="amount" 
                type="number" 
                value={formData.amount} 
                onChange={handleChange} 
                disabled // Se autocalcula
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-4 justify-end">
            <Button type="button" variant="ghost" size="lg" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              variant="default" 
              size="lg" 
              iconName="Check"
              loading={loading}
            >
              Registrar Atleta
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default AddAthleteModal;