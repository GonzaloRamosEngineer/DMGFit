import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { createFullAthlete } from "../../../services/athletes"; 
import Icon from "../../../components/AppIcon";

const AddAthleteModal = ({ onClose, onAthleteAdded }) => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [planOptions, setPlanOptions] = useState([]);

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
    planOption: "",
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

  useEffect(() => {
    const fetchPlanOptions = async () => {
      if (!formData.planId) {
        setPlanOptions([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("plan_features")
          .select("feature")
          .eq("plan_id", formData.planId);

        if (error) throw error;
        const options = (data || [])
          .map((item) => (typeof item.feature === "string" ? item.feature.trim() : ""))
          .filter((option) => option !== "");
        setPlanOptions(Array.from(new Set(options)));
      } catch (error) {
        console.error("Error cargando opciones del plan:", error);
        setPlanOptions([]);
      }
    };

    fetchPlanOptions();
  }, [formData.planId]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "planId") {
      const selectedPlan = plans.find((p) => p.id === value);
      setFormData((prev) => ({
        ...prev,
        planId: value,
        planOption: "",
        amount: selectedPlan?.price || "",
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanDni = formData.dni.trim().replace(/\D/g, '');
      if (!cleanDni) throw new Error("El DNI es obligatorio.");

      const normalizedPlanOption = formData.planOption.trim();
      const selectedPlanOption = normalizedPlanOption === "" ? null : normalizedPlanOption;

      if (selectedPlanOption && !planOptions.includes(selectedPlanOption)) {
        throw new Error("La opción seleccionada no corresponde al plan elegido.");
      }

      const result = await createFullAthlete({
        full_name: formData.fullName,
        email: formData.email.trim(),
        dni: cleanDni,
        phone: formData.phone,
        plan_id: formData.planId,
        coach_id: formData.coachId || null,
        plan_option: selectedPlanOption,
        join_date: formData.joinDate || null,
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

      onAthleteAdded();
      onClose();

    } catch (error) {
      console.error("Error registrando atleta:", error);
      alert(error.message || "Error al registrar el atleta");
    } finally {
      setLoading(false);
    }
  };

  // Clases más compactas para ahorrar espacio vertical
  const inputClasses = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all placeholder:text-slate-400";
  const labelClasses = "text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      
      {/* Modal Container: Max width grande para permitir 2 columnas cómodas */}
      <div className="bg-white border border-slate-100 rounded-[2rem] w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
              <Icon name="UserPlus" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Nuevo Atleta</h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5">Creación de cuenta y acceso al portal</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Body / Form - AHORA EN GRID DE 2 COLUMNAS */}
        <form id="add-athlete-form" onSubmit={handleSubmit} className="overflow-y-auto p-6 custom-scrollbar flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
            
            {/* --- COLUMNA IZQUIERDA --- */}
            <div className="space-y-6">
              
              {/* Sección 1: Identidad y Acceso */}
              <section>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
                  <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-500 flex items-center justify-center">
                    <Icon name="User" size={12} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">Identidad y Acceso</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelClasses}>Nombre Completo <span className="text-rose-500">*</span></label>
                    <input name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Ej: Juan Pérez" className={inputClasses} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>DNI (Números) <span className="text-rose-500">*</span></label>
                      <input name="dni" value={formData.dni} onChange={handleChange} required placeholder="12345678" className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>Teléfono</label>
                      <input name="phone" value={formData.phone} onChange={handleChange} placeholder="+54 9..." className={inputClasses} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Sección 2: Ficha Técnica */}
              <section>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
                  <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <Icon name="FileText" size={12} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">Ficha Técnica</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Fecha Nacimiento</label>
                      <input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>Género</label>
                      <select name="gender" value={formData.gender} onChange={handleChange} className={`${inputClasses} appearance-none cursor-pointer`}>
                        <option value="select" disabled>Seleccionar...</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="X">Otro</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Ciudad/Barrio</label>
                      <input name="city" value={formData.city} onChange={handleChange} placeholder="Ej: Centro" className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>Dirección</label>
                      <input name="address" value={formData.address} onChange={handleChange} placeholder="Calle y Nro" className={inputClasses} />
                    </div>
                  </div>
                </div>
              </section>

            </div>

            {/* --- COLUMNA DERECHA --- */}
            <div className="space-y-6">
              
              {/* Sección 3: Salud */}
              <section>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
                  <div className="w-6 h-6 rounded bg-rose-50 text-rose-500 flex items-center justify-center">
                    <Icon name="Heart" size={12} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">Salud y Emergencia</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Contacto Emergencia</label>
                      <input name="emergencyName" value={formData.emergencyName} onChange={handleChange} placeholder="Nombre" className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>Tel. Emergencia</label>
                      <input name="emergencyPhone" value={formData.emergencyPhone} onChange={handleChange} placeholder="Teléfono" className={inputClasses} />
                    </div>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <label className="text-xs font-black text-amber-800 flex items-center gap-1.5 mb-2">
                      <Icon name="AlertCircle" size={14} />
                      Condiciones Médicas / Lesiones
                    </label>
                    <textarea 
                      name="medicalConditions" 
                      value={formData.medicalConditions} 
                      onChange={handleChange} 
                      placeholder="Apto físico, alergias..." 
                      rows={2} 
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white/60 text-amber-900 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 placeholder:text-amber-700/50 transition-all resize-none text-sm font-medium" 
                    />
                  </div>
                </div>
              </section>

              {/* Sección 4: Membresía */}
              <section>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
                  <div className="w-6 h-6 rounded bg-violet-50 text-violet-500 flex items-center justify-center">
                    <Icon name="CreditCard" size={12} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">Membresía Inicial</h3>
                </div>
                
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Plan <span className="text-rose-500">*</span></label>
                      <select name="planId" value={formData.planId} onChange={handleChange} className={`${inputClasses} appearance-none cursor-pointer bg-white`} required>
                        <option value="" disabled>Seleccionar...</option>
                        {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClasses}>Entrenador</label>
                      <select name="coachId" value={formData.coachId} onChange={handleChange} className={`${inputClasses} appearance-none cursor-pointer bg-white`}>
                        <option value="">Sin Entrenador</option>
                        {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Opción / Variante</label>
                      <select
                        name="planOption"
                        value={formData.planOption}
                        onChange={handleChange}
                        className={`${inputClasses} appearance-none cursor-pointer bg-white`}
                        disabled={!formData.planId || planOptions.length === 0}
                      >
                        <option value="">{!formData.planId ? "Selecciona un plan primero" : "Sin opción"}</option>
                        {planOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Fecha de Inicio</label>
                      <input type="date" name="joinDate" value={formData.joinDate} onChange={handleChange} className={`${inputClasses} bg-white`} />
                    </div>
                    <div>
                      <label className={labelClasses}>Monto Inicial</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input type="number" value={formData.amount} disabled className="w-full h-[42px] pl-7 pr-3 rounded-xl border border-slate-200 bg-slate-100/50 text-slate-600 font-black cursor-not-allowed text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

            </div>
          </div>
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
              form="add-athlete-form"
              type="submit" 
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all ${loading ? 'opacity-70 cursor-wait' : 'hover:-translate-y-0.5'}`}
            >
              {loading ? (
                <><Icon name="Loader" size={16} className="animate-spin" /> Procesando...</>
              ) : (
                <><Icon name="Check" size={16} /> Registrar Atleta</>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AddAthleteModal;