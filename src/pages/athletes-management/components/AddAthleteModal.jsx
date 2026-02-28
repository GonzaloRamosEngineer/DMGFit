import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { createFullAthlete } from "../../../services/athletes";
import { fetchPlanPricing, fetchPlanSlots } from "../../../services/plans";
import Icon from "../../../components/AppIcon";

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const AddAthleteModal = ({ onClose, onAthleteAdded }) => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [planOptions, setPlanOptions] = useState([]);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [planSlots, setPlanSlots] = useState([]);
  const [preferredTimeKey, setPreferredTimeKey] = useState("");

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
    visitsPerWeek: 1,
    selectedSlotIds: [],
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
          .map((item) =>
            typeof item.feature === "string" ? item.feature.trim() : ""
          )
          .filter(Boolean);

        setPlanOptions(Array.from(new Set(options)));
      } catch (error) {
        console.error("Error cargando opciones del plan:", error);
        setPlanOptions([]);
      }
    };

    fetchPlanOptions();
  }, [formData.planId]);

  useEffect(() => {
    const fetchPlanConfig = async () => {
      if (!formData.planId) {
        setPricingTiers([]);
        setPlanSlots([]);
        setPreferredTimeKey("");
        setFormData((prev) => ({
          ...prev,
          amount: "",
          selectedSlotIds: [],
        }));
        return;
      }

      try {
        const [tiers, slots] = await Promise.all([
          fetchPlanPricing(formData.planId),
          fetchPlanSlots(formData.planId),
        ]);

        setPricingTiers(tiers || []);
        setPlanSlots(slots || []);
      } catch (error) {
        console.error("Error cargando configuración de plan:", error);
        setPricingTiers([]);
        setPlanSlots([]);
      }
    };

    fetchPlanConfig();
  }, [formData.planId]);

  useEffect(() => {
    const tier = pricingTiers.find(
      (item) => Number(item.visits_per_week) === Number(formData.visitsPerWeek)
    );

    if (tier) {
      setFormData((prev) => ({ ...prev, amount: tier.price }));
      return;
    }

    const selectedPlan = plans.find((p) => p.id === formData.planId);
    if (selectedPlan) {
      setFormData((prev) => ({ ...prev, amount: selectedPlan.price || "" }));
    }
  }, [pricingTiers, formData.visitsPerWeek, formData.planId, plans]);

  const availableSlots = useMemo(() => {
    return (planSlots || []).map((slot) => ({
      ...slot,
      dayLabel: DAYS[Number(slot.day_of_week)] || "Día",
      timeLabel: `${String(slot.start_time).slice(0, 5)} - ${String(
        slot.end_time
      ).slice(0, 5)}`,
      timeKey: `${String(slot.start_time).slice(0, 5)}-${String(slot.end_time).slice(
        0,
        5
      )}`,
      full: Number(slot.remaining) <= 0,
      selected: formData.selectedSlotIds.includes(slot.weekly_schedule_id),
    }));
  }, [planSlots, formData.selectedSlotIds]);

  const groupedSlotsByDay = useMemo(() => {
    return DAYS.map((day, dayIndex) => ({
      day,
      dayIndex,
      slots: availableSlots.filter((slot) => Number(slot.day_of_week) === dayIndex),
    })).filter((group) => group.slots.length > 0);
  }, [availableSlots]);

  const timeGroups = useMemo(() => {
    const grouped = new Map();

    availableSlots.forEach((slot) => {
      if (!grouped.has(slot.timeKey)) {
        grouped.set(slot.timeKey, {
          timeKey: slot.timeKey,
          label: slot.timeLabel,
          totalDays: 0,
          availableDays: 0,
        });
      }

      const entry = grouped.get(slot.timeKey);
      entry.totalDays += 1;
      if (!slot.full || slot.selected) entry.availableDays += 1;
    });

    return Array.from(grouped.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [availableSlots]);

  const selectedSlotsDetailed = useMemo(() => {
    return availableSlots
      .filter((slot) => formData.selectedSlotIds.includes(slot.weekly_schedule_id))
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return a.start_time.localeCompare(b.start_time);
      });
  }, [availableSlots, formData.selectedSlotIds]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "planId") {
      const selectedPlan = plans.find((p) => p.id === value);
      setPreferredTimeKey("");
      setFormData((prev) => ({
        ...prev,
        planId: value,
        planOption: "",
        selectedSlotIds: [],
        amount: selectedPlan?.price || "",
      }));
      return;
    }

    if (name === "visitsPerWeek") {
      const nextVisits = Number(value);
      setPreferredTimeKey("");
      setFormData((prev) => ({
        ...prev,
        visitsPerWeek: nextVisits,
        selectedSlotIds: prev.selectedSlotIds.slice(0, nextVisits),
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleSlot = (slotId) => {
    setFormData((prev) => {
      const exists = prev.selectedSlotIds.includes(slotId);

      if (exists) {
        return {
          ...prev,
          selectedSlotIds: prev.selectedSlotIds.filter((id) => id !== slotId),
        };
      }

      if (prev.selectedSlotIds.length >= Number(prev.visitsPerWeek)) {
        return prev;
      }

      return {
        ...prev,
        selectedSlotIds: [...prev.selectedSlotIds, slotId],
      };
    });
  };

  const applyPreferredTime = (timeKey) => {
    setPreferredTimeKey(timeKey);

    const visitsNeeded = Number(formData.visitsPerWeek);

    const matchingSlots = availableSlots
      .filter((slot) => slot.timeKey === timeKey && (!slot.full || slot.selected))
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return a.start_time.localeCompare(b.start_time);
      });

    const usedDays = new Set();
    const nextSelected = [];

    for (const slot of matchingSlots) {
      if (nextSelected.length >= visitsNeeded) break;
      if (usedDays.has(slot.day_of_week)) continue;

      usedDays.add(slot.day_of_week);
      nextSelected.push(slot.weekly_schedule_id);
    }

    setFormData((prev) => ({
      ...prev,
      selectedSlotIds: nextSelected,
    }));
  };

  const clearSelection = () => {
    setPreferredTimeKey("");
    setFormData((prev) => ({
      ...prev,
      selectedSlotIds: [],
    }));
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanDni = formData.dni.trim().replace(/\D/g, "");
      if (!cleanDni) throw new Error("El DNI es obligatorio.");

      const normalizedPlanOption = formData.planOption.trim();
      const selectedPlanOption =
        normalizedPlanOption === "" ? null : normalizedPlanOption;

      if (selectedPlanOption && !planOptions.includes(selectedPlanOption)) {
        throw new Error("La opción seleccionada no corresponde al plan elegido.");
      }

      const visitsPerWeek = Number(formData.visitsPerWeek);
      if (!visitsPerWeek || visitsPerWeek <= 0) {
        throw new Error("Debes seleccionar visitas por semana.");
      }

      if (formData.selectedSlotIds.length !== visitsPerWeek) {
        throw new Error(
          `Debes seleccionar exactamente ${visitsPerWeek} cupos semanales.`
        );
      }

      const fullSlotIds = new Set(
        planSlots
          .filter((slot) => Number(slot.remaining) <= 0)
          .map((slot) => slot.weekly_schedule_id)
      );

      if (formData.selectedSlotIds.some((slotId) => fullSlotIds.has(slotId))) {
        throw new Error("Uno o más cupos seleccionados ya no están disponibles.");
      }

      const tierMatch = pricingTiers.find(
        (tier) => Number(tier.visits_per_week) === visitsPerWeek
      );
      const tierPrice = tierMatch
        ? Number(tierMatch.price)
        : Number(formData.amount || 0);

      const result = await createFullAthlete({
        full_name: formData.fullName,
        email: formData.email.trim(),
        dni: cleanDni,
        phone: formData.phone,
        plan_id: formData.planId,
        coach_id: formData.coachId || null,
        plan_option: selectedPlanOption,
        visits_per_week: visitsPerWeek,
        selected_weekly_schedule_ids: formData.selectedSlotIds,
        tier_price: tierPrice,
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

  const inputClasses =
    "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all placeholder:text-slate-400";
  const labelClasses =
    "text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 rounded-[2rem] w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
              <Icon name="UserPlus" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                Nuevo Atleta
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5">
                Creación de cuenta y asignación semanal
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

        <form
          id="add-athlete-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto p-6 custom-scrollbar flex-1"
        >
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-6">
            {/* Izquierda */}
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
                  <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-500 flex items-center justify-center">
                    <Icon name="User" size={12} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">
                    Identidad y Acceso
                  </h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelClasses}>
                      Nombre Completo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      placeholder="Ej: Juan Pérez"
                      className={inputClasses}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>
                        DNI (Números) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        name="dni"
                        value={formData.dni}
                        onChange={handleChange}
                        required
                        placeholder="12345678"
                        className={inputClasses}
                      />
                    </div>
                    <div>
                      <label className={labelClasses}>Teléfono</label>
                      <input
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+54 9..."
                        className={inputClasses}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
                  <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <Icon name="FileText" size={12} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">
                    Ficha Técnica
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Fecha Nacimiento</label>
                      <input
                        type="date"
                        name="birthDate"
                        value={formData.birthDate}
                        onChange={handleChange}
                        className={inputClasses}
                      />
                    </div>
                    <div>
                      <label className={labelClasses}>Género</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className={`${inputClasses} appearance-none cursor-pointer`}
                      >
                        <option value="select" disabled>
                          Seleccionar...
                        </option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="X">Otro</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Ciudad/Barrio</label>
                      <input
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        placeholder="Ej: Centro"
                        className={inputClasses}
                      />
                    </div>
                    <div>
                      <label className={labelClasses}>Dirección</label>
                      <input
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Calle y Nro"
                        className={inputClasses}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
                  <div className="w-6 h-6 rounded bg-rose-50 text-rose-500 flex items-center justify-center">
                    <Icon name="Heart" size={12} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">
                    Salud y Emergencia
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Contacto Emergencia</label>
                      <input
                        name="emergencyName"
                        value={formData.emergencyName}
                        onChange={handleChange}
                        placeholder="Nombre"
                        className={inputClasses}
                      />
                    </div>
                    <div>
                      <label className={labelClasses}>Tel. Emergencia</label>
                      <input
                        name="emergencyPhone"
                        value={formData.emergencyPhone}
                        onChange={handleChange}
                        placeholder="Teléfono"
                        className={inputClasses}
                      />
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
            </div>

            {/* Derecha */}
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
                  <div className="w-6 h-6 rounded bg-violet-50 text-violet-500 flex items-center justify-center">
                    <Icon name="CreditCard" size={12} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">
                    Membresía Inicial
                  </h3>
                </div>

                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>
                        Plan <span className="text-rose-500">*</span>
                      </label>
                      <select
                        name="planId"
                        value={formData.planId}
                        onChange={handleChange}
                        className={`${inputClasses} appearance-none cursor-pointer bg-white`}
                        required
                      >
                        <option value="" disabled>
                          Seleccionar...
                        </option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClasses}>Entrenador</label>
                      <select
                        name="coachId"
                        value={formData.coachId}
                        onChange={handleChange}
                        className={`${inputClasses} appearance-none cursor-pointer bg-white`}
                      >
                        <option value="">Sin Entrenador</option>
                        {coaches.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
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
                        <option value="">
                          {!formData.planId
                            ? "Selecciona un plan primero"
                            : "Sin opción"}
                        </option>
                        {planOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClasses}>
                        Visitas por Semana <span className="text-rose-500">*</span>
                      </label>
                      <select
                        name="visitsPerWeek"
                        value={formData.visitsPerWeek}
                        onChange={handleChange}
                        className={`${inputClasses} appearance-none cursor-pointer bg-white`}
                      >
                        {[1, 2, 3, 4, 5].map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Monto Inicial</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          value={formData.amount}
                          disabled
                          className="w-full h-[42px] pl-7 pr-3 rounded-xl border border-slate-200 bg-slate-100/50 text-slate-600 font-black cursor-not-allowed text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClasses}>Fecha de Inicio</label>
                      <input
                        type="date"
                        name="joinDate"
                        value={formData.joinDate}
                        onChange={handleChange}
                        className={`${inputClasses} bg-white`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClasses}>Cupos Semanales (seleccionados {formData.selectedSlotIds.length}/{formData.visitsPerWeek}) <span className="text-rose-500">*</span></label>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {planSlots.length === 0 ? (
                        <p className="text-xs text-slate-400">Este plan no tiene cupos configurados.</p>
                      ) : planSlots.map((slot) => {
                        const slotId = slot.weekly_schedule_id;
                        const selected = formData.selectedSlotIds.includes(slotId);
                        const full = Number(slot.remaining) <= 0 && !selected;
                        const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][slot.day_of_week] || 'Día';
                        return (
                          <label key={slotId} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold ${full ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-slate-700 border-slate-200 cursor-pointer'}`}>
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={selected} disabled={full} onChange={() => toggleSlot(slotId)} />
                              <span>{dayName} {String(slot.start_time).slice(0,5)}-{String(slot.end_time).slice(0,5)}</span>
                            </div>
                            <span className={`font-black ${Number(slot.remaining) <= 1 ? 'text-rose-500' : 'text-emerald-600'}`}>{slot.remaining}/{slot.capacity}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Fecha de Inicio</label>
                      <input type="date" name="joinDate" value={formData.joinDate} onChange={handleChange} className={`${inputClasses} bg-white`} />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
                  <div className="w-6 h-6 rounded bg-sky-50 text-sky-500 flex items-center justify-center">
                    <Icon name="CalendarDays" size={12} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">
                    Disponibilidad Semanal
                  </h3>
                </div>

                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <label className={labelClasses}>
                      Cupos semanales (seleccionados {formData.selectedSlotIds.length}/
                      {formData.visitsPerWeek}){" "}
                      <span className="text-rose-500">*</span>
                    </label>

                    {formData.selectedSlotIds.length > 0 && (
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors"
                      >
                        Limpiar selección
                      </button>
                    )}
                  </div>

                  {/* Selección rápida */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="Sparkles" size={14} className="text-blue-500" />
                      <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Mismo horario en varios días
                      </p>
                    </div>

                    {timeGroups.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        Selecciona un plan para ver horarios disponibles.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500 mb-3">
                          Elegí un horario y el sistema intentará aplicarlo en varios días
                          hasta completar las {formData.visitsPerWeek} visitas semanales.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {timeGroups.map((group) => {
                            const active = preferredTimeKey === group.timeKey;
                            return (
                              <button
                                key={group.timeKey}
                                type="button"
                                onClick={() => applyPreferredTime(group.timeKey)}
                                className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                                  active
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                                }`}
                              >
                                {group.label} · {group.availableDays}/{group.totalDays} días
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Selección actual */}
                  {selectedSlotsDetailed.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <p className="text-xs font-black text-emerald-800 uppercase tracking-wider mb-2">
                        Selección actual
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedSlotsDetailed.map((slot) => (
                          <span
                            key={slot.weekly_schedule_id}
                            className="px-3 py-1.5 rounded-full bg-white border border-emerald-200 text-xs font-bold text-emerald-700"
                          >
                            {slot.dayLabel} · {slot.timeLabel}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Slots agrupados por día */}
                  <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
                    {groupedSlotsByDay.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        Este plan no tiene slots configurados.
                      </p>
                    ) : (
                      groupedSlotsByDay.map((group) => (
                        <div
                          key={group.dayIndex}
                          className="bg-white border border-slate-200 rounded-xl p-3"
                        >
                          <h4 className="text-sm font-black text-slate-700 mb-3">
                            {group.day}
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {group.slots.map((slot) => {
                              const disabled =
                                slot.full && !slot.selected;

                              return (
                                <button
                                  key={slot.weekly_schedule_id}
                                  type="button"
                                  disabled={
                                    disabled ||
                                    (!slot.selected &&
                                      formData.selectedSlotIds.length >=
                                        Number(formData.visitsPerWeek))
                                  }
                                  onClick={() => toggleSlot(slot.weekly_schedule_id)}
                                  className={`text-left px-3 py-3 rounded-xl border transition-all ${
                                    slot.selected
                                      ? "border-blue-600 bg-blue-50 text-blue-700"
                                      : disabled
                                      ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-black">
                                      {slot.timeLabel}
                                    </span>
                                    <span
                                      className={`text-xs font-black ${
                                        Number(slot.remaining) <= 1
                                          ? "text-rose-500"
                                          : "text-emerald-600"
                                      }`}
                                    >
                                      {slot.remaining}/{slot.capacity}
                                    </span>
                                  </div>
                                  <p className="text-[11px] mt-1 font-semibold">
                                    {slot.selected
                                      ? "Seleccionado"
                                      : disabled
                                      ? "Sin cupo"
                                      : "Disponible"}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </form>

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
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all ${
                loading ? "opacity-70 cursor-wait" : "hover:-translate-y-0.5"
              }`}
            >
              {loading ? (
                <>
                  <Icon name="Loader" size={16} className="animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Icon name="Check" size={16} />
                  Registrar Atleta
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddAthleteModal;
