import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { createFullAthlete, checkDniExists } from "../../../services/athletes"; // Importamos los nuevos servicios
import Icon from "../../../components/AppIcon";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";

const AddAthleteModal = ({ onClose, onAthleteAdded }) => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [coaches, setCoaches] = useState([]);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    dni: "",
    birthDate: "",
    gender: "select",
    phone: "",
    address: "",
    city: "",
    emergencyName: "",
    emergencyPhone: "",
    medicalConditions: "",
    planId: "",
    coachId: "",
    joinDate: new Date().toISOString().split("T")[0],
    amount: "", 
  });

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const [plansRes, coachesRes] = await Promise.all([
          supabase.from("plans").select("id, name, price").eq("status", "active"),
          supabase.from("coaches").select("id, profiles:profile_id(full_name)"),
        ]);

        if (plansRes.data) setPlans(plansRes.data);
        if (coachesRes.data) {
          setCoaches(
            coachesRes.data.map((c) => ({
              id: c.id,
              name: c.profiles?.full_name || "Coach",
            }))
          );
        }
      } catch (error) {
        console.error("Error cargando recursos:", error);
      }
    };
    fetchResources();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "planId") {
      const selectedPlan = plans.find((p) => p.id === value);
      if (selectedPlan) {
        setFormData((prev) => ({
          ...prev,
          planId: value,
          amount: selectedPlan.price,
        }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Limpieza y validación de DNI
      const cleanDni = formData.dni.trim().replace(/\D/g, '');
      if (!cleanDni) throw new Error("El DNI es obligatorio.");

      // 3. Llamada al servicio integral
      // Esta función ahora maneja Auth + Profile + Athlete + Enrollment + Payment
      const result = await createFullAthlete({
        full_name: formData.fullName,
        email: formData.email.trim(),
        dni: cleanDni,
        phone: formData.phone,
        plan_id: formData.planId,
        coach_id: formData.coachId || null,
        // Pasamos datos extra para el perfil extendido
        birth_date: formData.birthDate,
        gender: formData.gender !== "select" ? formData.gender : null,
        address: formData.address,
        city: formData.city,
        emergency_contact_name: formData.emergencyName,
        emergency_contact_phone: formData.emergencyPhone,
        medical_conditions: formData.medicalConditions,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Éxito
      onAthleteAdded();
      onClose();

    } catch (error) {
      console.error("Error registrando atleta:", error);
      alert(error.message || "Error al registrar el atleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-border rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-white via-white to-primary/5 border-b border-border px-8 py-6 z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-lg">
                <Icon name="UserPlus" size={24} color="white" />
              </div>
              <div>
                <h2 className="text-2xl font-heading font-bold text-foreground">Nuevo Atleta</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Creación de cuenta y acceso al portal</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 hover:bg-muted/50 rounded-xl transition-all">
              <Icon name="X" size={20} color="var(--color-muted-foreground)" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(92vh-140px)] custom-scrollbar">
          <div className="px-8 py-6 space-y-8">
            
            {/* Sección 1: Identidad y Acceso */}
            <section className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-primary/20">
                <Icon name="User" size={20} color="var(--color-primary)" />
                <h3 className="text-base font-bold text-foreground">Identidad y Acceso</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input label="Nombre Completo *" name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Ej: Juan Pérez" />
                
                {/* <div className="flex flex-col gap-1">
                  <Input label="Email (opcional)" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="ejemplo@gmail.com" />
                  <p className="text-[10px] text-primary font-medium px-1 italic">
                    Si no se ingresa, se asigna un email interno y la cuenta queda pendiente de habilitación.
                  </p>
                </div> */}

                <Input label="DNI (Solo números) *" name="dni" value={formData.dni} onChange={handleChange} required placeholder="12345678" />
                <Input label="Teléfono" name="phone" value={formData.phone} onChange={handleChange} placeholder="+54 9..." />
              </div>
            </section>

            {/* Sección 2: Ficha Técnica */}
            <section className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-accent/20">
                <Icon name="FileText" size={20} color="var(--color-accent)" />
                <h3 className="text-base font-bold text-foreground">Ficha Técnica</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Input label="Fecha de Nacimiento" name="birthDate" type="date" value={formData.birthDate} onChange={handleChange} />
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Género</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className="h-11 px-4 rounded-xl border-2 border-border bg-white text-sm focus:ring-2 focus:ring-primary outline-none">
                    <option value="select" disabled>Seleccionar...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="X">Otro</option>
                  </select>
                </div>
                <Input label="Ciudad/Barrio" name="city" value={formData.city} onChange={handleChange} placeholder="Ej: Centro" />
              </div>
              <Input label="Dirección Completa" name="address" value={formData.address} onChange={handleChange} placeholder="Calle y número" />
            </section>

            {/* Sección 3: Salud */}
            <section className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-error/20">
                <Icon name="Heart" size={20} color="var(--color-error)" />
                <h3 className="text-base font-bold text-foreground">Salud y Emergencia</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input label="Contacto Emergencia" name="emergencyName" value={formData.emergencyName} onChange={handleChange} />
                <Input label="Teléfono Emergencia" name="emergencyPhone" value={formData.emergencyPhone} onChange={handleChange} />
              </div>
              <div className="bg-warning/5 border-2 border-warning/20 rounded-xl p-4">
                <label className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Icon name="AlertCircle" size={16} color="var(--color-warning)" />
                  Condiciones Médicas / Lesiones
                </label>
                <textarea name="medicalConditions" value={formData.medicalConditions} onChange={handleChange} placeholder="Apto físico, alergias..." rows={3} className="w-full px-4 py-3 rounded-lg border-2 border-border bg-white text-sm outline-none resize-none" />
              </div>
            </section>

            {/* Sección 4: Membresía */}
            <section className="space-y-5 pb-8">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-secondary/20">
                <Icon name="CreditCard" size={20} color="var(--color-secondary)" />
                <h3 className="text-base font-bold text-foreground">Membresía Inicial</h3>
              </div>
              <div className="bg-gradient-to-br from-primary/5 to-accent/5 border-2 border-primary/20 rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Plan Seleccionado *</label>
                  <select name="planId" value={formData.planId} onChange={handleChange} className="h-11 px-4 rounded-xl border-2 border-border bg-white text-sm outline-none" required>
                    <option value="" disabled>Seleccionar Plan...</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Entrenador Asignado</label>
                  <select name="coachId" value={formData.coachId} onChange={handleChange} className="h-11 px-4 rounded-xl border-2 border-border bg-white text-sm outline-none">
                    <option value="">Sin Entrenador (Opcional)</option>
                    {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <Input label="Fecha de Inicio" name="joinDate" type="date" value={formData.joinDate} onChange={handleChange} />
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Monto Inicial (Deuda Automática)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                    <input type="number" value={formData.amount} disabled className="w-full h-11 pl-8 pr-4 rounded-xl border-2 border-border bg-muted/30 text-sm font-bold cursor-not-allowed" />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-border px-8 py-5 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Icon name="Info" size={16} />
              Campos con <span className="text-error font-bold">*</span> son obligatorios
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" size="lg" onClick={onClose} className="min-w-[120px]">Cancelar</Button>
              <Button type="submit" variant="default" size="lg" iconName="Check" loading={loading} className="min-w-[180px]">
                {loading ? 'Procesando alta...' : 'Registrar Atleta'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAthleteModal;
