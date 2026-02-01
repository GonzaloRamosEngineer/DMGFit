import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import Icon from "../../../components/AppIcon";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";

const AddAthleteModal = ({ onClose, onAthleteAdded }) => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [coaches, setCoaches] = useState([]);

  // Estado del formulario
  const [formData, setFormData] = useState({
    // Identidad
    fullName: "",
    email: "",
    dni: "",

    // Ficha Técnica
    birthDate: "",
    gender: "select",
    phone: "",
    address: "",
    city: "",

    // Emergencia
    emergencyName: "",
    emergencyPhone: "",
    medicalConditions: "",

    // Membresía
    planId: "",
    coachId: "",
    joinDate: new Date().toISOString().split("T")[0],
    amount: "", // Se autocalcula
  });

  // 1. Cargar Planes y Coaches al abrir el modal
  useEffect(() => {
    const fetchResources = async () => {
      try {
        const [plansRes, coachesRes] = await Promise.all([
          supabase
            .from("plans")
            .select("id, name, price")
            .eq("status", "active"),
          supabase.from("coaches").select("id, profiles:profile_id(full_name)"),
        ]);

        if (plansRes.data) setPlans(plansRes.data);
        if (coachesRes.data) {
          // Formateamos para el select
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

  // 2. Manejo de cambios
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Si cambia el plan, actualizamos el precio automáticamente
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

  // 3. Guardar Atleta (La magia)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // A) Crear Usuario Simulado en Perfiles (Identidad)
      const newProfileId = crypto.randomUUID();

      const { error: profileError } = await supabase.from("profiles").insert({
        id: newProfileId,
        full_name: formData.fullName,
        email: formData.email,
        role: "atleta",
      });

      if (profileError) throw profileError;

      // B) Crear Ficha de Atleta
      const { data: newAthlete, error: athleteError } = await supabase
        .from("athletes")
        .insert({
          profile_id: newProfileId,
          dni: formData.dni,
          birth_date: formData.birthDate || null,
          gender: formData.gender !== "select" ? formData.gender : null,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          emergency_contact_name: formData.emergencyName,
          emergency_contact_phone: formData.emergencyPhone,
          medical_conditions: formData.medicalConditions,
          coach_id: formData.coachId || null,
          status: "active",
          join_date: formData.joinDate,
          plan_id: formData.planId || null
        })
        .select()
        .single();

      if (athleteError) throw athleteError;

      // C) Generar Deuda Inicial (Pago Pendiente)
      if (formData.planId) {
        const { error: paymentError } = await supabase.from("payments").insert({
          athlete_id: newAthlete.id,
          amount: formData.amount,
          status: "pending",
          payment_date: formData.joinDate,
          method: "efectivo",
          concept: `Inscripción - ${
            plans.find((p) => p.id === formData.planId)?.name
          }`,
        });
        if (paymentError)
          console.error("Error creando pago inicial", paymentError);
      }

      onAthleteAdded();
      onClose();

    } catch (error) {
      console.error("Error registrando atleta:", error);

      if (
        error.code === "23505" ||
        error.message?.includes("profiles_email_key")
      ) {
        alert(
          "Error: El correo electrónico ya está registrado en el sistema. Por favor use otro."
        );
      } else {
        alert("Error al registrar: " + (error.message || "Error desconocido"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-border rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header - Fixed */}
        <div className="sticky top-0 bg-gradient-to-r from-white via-white to-primary/5 border-b border-border px-8 py-6 z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-lg">
                  <Icon name="UserPlus" size={24} color="white" />
                </div>
                <div>
                  <h2 className="text-2xl font-heading font-bold text-foreground">
                    Nuevo Atleta
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Complete todos los campos requeridos
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-muted/50 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              aria-label="Cerrar modal"
            >
              <Icon name="X" size={20} color="var(--color-muted-foreground)" />
            </button>
          </div>
        </div>

        {/* Form Content - Scrollable */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(92vh-140px)] custom-scrollbar">
          <div className="px-8 py-6 space-y-8">
            
            {/* Sección 1: Identidad y Acceso */}
            <section className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-primary/20">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="User" size={20} color="var(--color-primary)" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Identidad y Acceso
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Información básica y credenciales
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  label="Nombre Completo"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="Ej: Juan Pérez"
                />
                <Input
                  label="Email (Usuario)"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="ejemplo@gmail.com"
                />
                <Input
                  label="DNI (Contraseña Inicial)"
                  name="dni"
                  value={formData.dni}
                  onChange={handleChange}
                  required
                  placeholder="12345678 (sin puntos)"
                />
                <Input
                  label="Teléfono"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+54 9 3877 77 7777"
                />
              </div>
            </section>

            {/* Sección 2: Ficha Técnica */}
            <section className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-accent/20">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Icon name="FileText" size={20} color="var(--color-accent)" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Ficha Técnica
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Datos personales y demográficos
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Input
                  label="Fecha de Nacimiento"
                  name="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={handleChange}
                />

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-foreground">
                    Género
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="h-11 px-4 rounded-xl border-2 border-border bg-white text-sm font-medium text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  >
                    <option value="select" disabled>
                      Seleccionar...
                    </option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="X">Otro</option>
                  </select>
                </div>

                <Input
                  label="Ciudad/Barrio"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Ej: Centro"
                />
              </div>

              <Input
                label="Dirección Completa"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Calle, número, apartamento"
              />
            </section>

            {/* Sección 3: Salud y Emergencia */}
            <section className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-error/20">
                <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center">
                  <Icon name="Heart" size={20} color="var(--color-error)" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Salud y Emergencia
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Información médica y contacto de emergencia
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  label="Contacto de Emergencia (Nombre)"
                  name="emergencyName"
                  value={formData.emergencyName}
                  onChange={handleChange}
                  placeholder="Nombre completo"
                />
                <Input
                  label="Teléfono de Emergencia"
                  name="emergencyPhone"
                  value={formData.emergencyPhone}
                  onChange={handleChange}
                  placeholder="+54 9 3877 77 7777"
                />
              </div>

              <div className="bg-warning/5 border-2 border-warning/20 rounded-xl p-4">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Icon name="AlertCircle" size={16} color="var(--color-warning)" />
                  Condiciones Médicas / Lesiones
                </label>
                <textarea
                  name="medicalConditions"
                  value={formData.medicalConditions}
                  onChange={handleChange}
                  placeholder="Apto físico, alergias, operaciones previas, lesiones actuales..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border-2 border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-warning focus:border-warning outline-none transition-all resize-none"
                />
              </div>
            </section>

            {/* Sección 4: Membresía */}
            <section className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-secondary/20">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Icon name="CreditCard" size={20} color="var(--color-secondary)" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Membresía Inicial
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Plan y asignación de Entrenador
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary/5 to-accent/5 border-2 border-primary/20 rounded-xl p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      Plan Seleccionado
                      <span className="text-error">*</span>
                    </label>
                    <select
                      name="planId"
                      value={formData.planId}
                      onChange={handleChange}
                      className="h-11 px-4 rounded-xl border-2 border-border bg-white text-sm font-medium text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                      required
                    >
                      <option value="" disabled>
                        Seleccionar Plan...
                      </option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - ${p.price}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-foreground">
                      Entrenador Asignado
                    </label>
                    <select
                      name="coachId"
                      value={formData.coachId}
                      onChange={handleChange}
                      className="h-11 px-4 rounded-xl border-2 border-border bg-white text-sm font-medium text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    >
                      <option value="">Sin Entrenador (Opcional)</option>
                      {coaches.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
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

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-foreground">
                      Monto Inicial (Deuda)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleChange}
                        disabled
                        className="w-full h-11 pl-8 pr-4 rounded-xl border-2 border-border bg-muted/30 text-sm font-bold text-foreground outline-none cursor-not-allowed"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Icon name="Info" size={12} />
                      Se calcula automáticamente según el plan
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Footer Actions - Fixed */}
          <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent border-t border-border px-8 py-5 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Icon name="Info" size={16} />
              Los campos marcados con <span className="text-error font-bold">*</span> son obligatorios
            </p>
            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="ghost" 
                size="lg" 
                onClick={onClose}
                className="min-w-[120px]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="default"
                size="lg"
                iconName="Check"
                loading={loading}
                className="min-w-[180px]"
              >
                {loading ? 'Registrando...' : 'Registrar Atleta'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAthleteModal;