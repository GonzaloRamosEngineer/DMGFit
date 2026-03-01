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

const STEPS = [
  { id: 1, label: "1. Datos del Atleta" },
  { id: 2, label: "2. Membresía Inicial" },
  { id: 3, label: "3. Disponibilidad Semanal" },
];

const normalizeRelation = (value) => {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
};

const getVisitsLabel = (value) => {
  const n = Number(value || 0);
  return `${n} ${n === 1 ? "vez" : "veces"} / semana`;
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const AddAthleteModal = ({ onClose, onAthleteAdded }) => {
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  const [plans, setPlans] = useState([]);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [planSlots, setPlanSlots] = useState([]);
  const [selectedRequestedDays, setSelectedRequestedDays] = useState([]);
  const [selectedSuggestedTimeKey, setSelectedSuggestedTimeKey] = useState("");

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
    visitsPerWeek: "",
    selectedSlotIds: [],
    joinDate: new Date().toISOString().split("T")[0],
    amount: "",
  });

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const { data, error } = await supabase
          .from("plans")
          .select("id, name, price, status")
          .eq("status", "active")
          .order("name", { ascending: true });

        if (error) throw error;
        setPlans(data || []);
      } catch (error) {
        console.error("Error cargando planes:", error);
      }
    };

    fetchResources();
  }, []);

  useEffect(() => {
    const fetchPlanConfig = async () => {
      if (!formData.planId) {
        setPricingTiers([]);
        setPlanSlots([]);
        setSelectedRequestedDays([]);
        setSelectedSuggestedTimeKey("");
        setFormData((prev) => ({
          ...prev,
          visitsPerWeek: "",
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

        const normalizedTiers = (tiers || [])
          .map((tier) => ({
            id: tier.id,
            visits_per_week: Number(tier.visits_per_week),
            price: Number(tier.price || 0),
          }))
          .filter((tier) => tier.visits_per_week > 0)
          .sort((a, b) => a.visits_per_week - b.visits_per_week);

        setPricingTiers(normalizedTiers);
        setPlanSlots(slots || []);
      } catch (error) {
        console.error("Error cargando configuración de plan:", error);
        setPricingTiers([]);
        setPlanSlots([]);
      }
    };

    fetchPlanConfig();
  }, [formData.planId]);

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.id === formData.planId) || null;
  }, [plans, formData.planId]);

  const availableVisitOptions = useMemo(() => {
    return Array.from(
      new Set(
        (pricingTiers || [])
          .map((tier) => Number(tier.visits_per_week))
          .filter((value) => value > 0)
      )
    ).sort((a, b) => a - b);
  }, [pricingTiers]);

  useEffect(() => {
    if (!formData.planId) return;

    if (availableVisitOptions.length === 0) {
      setSelectedRequestedDays([]);
      setSelectedSuggestedTimeKey("");
      setFormData((prev) => ({
        ...prev,
        visitsPerWeek: "",
        amount: selectedPlan?.price || "",
        selectedSlotIds: [],
      }));
      return;
    }

    const currentVisits = Number(formData.visitsPerWeek);
    const isCurrentValid = availableVisitOptions.includes(currentVisits);
    const nextVisits = isCurrentValid ? currentVisits : availableVisitOptions[0];

    const tier = pricingTiers.find(
      (item) => Number(item.visits_per_week) === Number(nextVisits)
    );

    setFormData((prev) => ({
      ...prev,
      visitsPerWeek: nextVisits,
      amount: tier ? tier.price : selectedPlan?.price || "",
      selectedSlotIds: isCurrentValid
        ? prev.selectedSlotIds.slice(0, Number(nextVisits))
        : [],
    }));

    if (!isCurrentValid) {
      setSelectedRequestedDays([]);
      setSelectedSuggestedTimeKey("");
    }
  }, [availableVisitOptions, pricingTiers, selectedPlan, formData.planId]);

  useEffect(() => {
    const visits = Number(formData.visitsPerWeek || 0);
    if (!visits) return;

    const tier = pricingTiers.find(
      (item) => Number(item.visits_per_week) === visits
    );

    if (tier) {
      setFormData((prev) => ({ ...prev, amount: tier.price }));
      return;
    }

    if (selectedPlan) {
      setFormData((prev) => ({ ...prev, amount: selectedPlan.price || "" }));
    }
  }, [pricingTiers, formData.visitsPerWeek, selectedPlan]);

  const availableSlots = useMemo(() => {
    return (planSlots || []).map((slot) => ({
      ...slot,
      dayLabel: DAYS[Number(slot.day_of_week)] || "Día",
      timeLabel: `${String(slot.start_time).slice(0, 5)} - ${String(
        slot.end_time
      ).slice(0, 5)}`,
      timeKey: `${String(slot.start_time).slice(0, 5)}-${String(
        slot.end_time
      ).slice(0, 5)}`,
      full: Number(slot.remaining) <= 0,
      selected: formData.selectedSlotIds.includes(slot.weekly_schedule_id),
    }));
  }, [planSlots, formData.selectedSlotIds]);

  const requestableDays = useMemo(() => {
    return DAYS.map((day, dayIndex) => {
      const slots = availableSlots.filter(
        (slot) => Number(slot.day_of_week) === dayIndex
      );

      if (slots.length === 0) return null;

      const availableCount = slots.filter(
        (slot) => !slot.full || slot.selected
      ).length;

      return {
        day,
        dayIndex,
        totalSlots: slots.length,
        availableCount,
        disabled: availableCount === 0,
      };
    }).filter(Boolean);
  }, [availableSlots]);

  useEffect(() => {
    const allowedDays = new Set(
      requestableDays.filter((day) => !day.disabled).map((day) => day.dayIndex)
    );
    const visits = Number(formData.visitsPerWeek || 0);

    setSelectedRequestedDays((prev) =>
      prev.filter((dayIndex) => allowedDays.has(dayIndex)).slice(0, visits)
    );
  }, [requestableDays, formData.visitsPerWeek]);

  const groupedSlotsByDay = useMemo(() => {
    return DAYS.map((day, dayIndex) => ({
      day,
      dayIndex,
      slots: availableSlots.filter((slot) => Number(slot.day_of_week) === dayIndex),
    })).filter((group) => group.slots.length > 0);
  }, [availableSlots]);

  const manualGroupsByDay = useMemo(() => {
    if (selectedRequestedDays.length > 0) {
      return groupedSlotsByDay.filter((group) =>
        selectedRequestedDays.includes(group.dayIndex)
      );
    }

    return groupedSlotsByDay;
  }, [groupedSlotsByDay, selectedRequestedDays]);

  const compatibleTimeGroups = useMemo(() => {
    const visits = Number(formData.visitsPerWeek || 0);
    if (!visits || selectedRequestedDays.length !== visits) return [];

    const selectedDaysSet = new Set(selectedRequestedDays);
    const grouped = new Map();

    availableSlots
      .filter(
        (slot) =>
          selectedDaysSet.has(Number(slot.day_of_week)) &&
          (!slot.full || slot.selected)
      )
      .forEach((slot) => {
        if (!grouped.has(slot.timeKey)) {
          grouped.set(slot.timeKey, {
            timeKey: slot.timeKey,
            label: slot.timeLabel,
            byDay: new Map(),
          });
        }

        grouped.get(slot.timeKey).byDay.set(Number(slot.day_of_week), slot);
      });

    const result = [];

    grouped.forEach((entry, timeKey) => {
      const hasAllDays = selectedRequestedDays.every((dayIndex) =>
        entry.byDay.has(dayIndex)
      );

      if (!hasAllDays) return;

      const slots = selectedRequestedDays
        .map((dayIndex) => entry.byDay.get(dayIndex))
        .filter(Boolean);

      result.push({
        timeKey,
        label: entry.label,
        slots,
        minRemaining: Math.min(
          ...slots.map((slot) => Number(slot.remaining || 0))
        ),
      });
    });

    return result.sort((a, b) => a.label.localeCompare(b.label));
  }, [availableSlots, selectedRequestedDays, formData.visitsPerWeek]);

  const selectedSlotsDetailed = useMemo(() => {
    return availableSlots
      .filter((slot) => formData.selectedSlotIds.includes(slot.weekly_schedule_id))
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return a.start_time.localeCompare(b.start_time);
      });
  }, [availableSlots, formData.selectedSlotIds]);

  const hasExactRequestedDays =
    Number(formData.visitsPerWeek || 0) > 0 &&
    selectedRequestedDays.length === Number(formData.visitsPerWeek || 0);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "planId") {
      setSelectedRequestedDays([]);
      setSelectedSuggestedTimeKey("");
      setFormData((prev) => ({
        ...prev,
        planId: value,
        visitsPerWeek: "",
        selectedSlotIds: [],
        amount: "",
      }));
      return;
    }

    if (name === "visitsPerWeek") {
      const nextVisits = Number(value);
      setSelectedRequestedDays([]);
      setSelectedSuggestedTimeKey("");
      setFormData((prev) => ({
        ...prev,
        visitsPerWeek: nextVisits,
        selectedSlotIds: [],
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleRequestedDay = (dayIndex, disabled) => {
    if (disabled) return;

    setSelectedSuggestedTimeKey("");
    setFormData((prev) => ({
      ...prev,
      selectedSlotIds: [],
    }));

    setSelectedRequestedDays((prev) => {
      const visits = Number(formData.visitsPerWeek || 0);
      const exists = prev.includes(dayIndex);

      if (exists) {
        return prev.filter((item) => item !== dayIndex);
      }

      if (prev.length >= visits) {
        return prev;
      }

      return [...prev, dayIndex].sort((a, b) => a - b);
    });
  };

  const applyCompatibleSchedule = (group) => {
    setSelectedSuggestedTimeKey(group.timeKey);
    setFormData((prev) => ({
      ...prev,
      selectedSlotIds: group.slots.map((slot) => slot.weekly_schedule_id),
    }));
  };

  const toggleSlot = (slotId) => {
    setSelectedSuggestedTimeKey("");

    setFormData((prev) => {
      const visits = Number(prev.visitsPerWeek || 0);
      const exists = prev.selectedSlotIds.includes(slotId);

      if (exists) {
        return {
          ...prev,
          selectedSlotIds: prev.selectedSlotIds.filter((id) => id !== slotId),
        };
      }

      if (prev.selectedSlotIds.length >= visits) {
        return prev;
      }

      return {
        ...prev,
        selectedSlotIds: [...prev.selectedSlotIds, slotId],
      };
    });
  };

  const clearSelection = () => {
    setSelectedSuggestedTimeKey("");
    setFormData((prev) => ({
      ...prev,
      selectedSlotIds: [],
    }));
  };

  const validateStep = (stepId) => {
    if (stepId === 1) {
      const cleanDni = formData.dni.trim().replace(/\D/g, "");
      if (!formData.fullName.trim()) {
        return "Debes completar el nombre del atleta.";
      }
      if (!cleanDni) {
        return "Debes completar el DNI del atleta.";
      }
      return null;
    }

    if (stepId === 2) {
      const step1Error = validateStep(1);
      if (step1Error) return step1Error;

      if (!formData.planId) {
        return "Debes seleccionar un plan.";
      }

      const visitsPerWeek = Number(formData.visitsPerWeek);
      if (!visitsPerWeek || visitsPerWeek <= 0) {
        return "Debes seleccionar una frecuencia semanal válida.";
      }

      return null;
    }

    if (stepId === 3) {
      const step2Error = validateStep(2);
      if (step2Error) return step2Error;

      const visitsPerWeek = Number(formData.visitsPerWeek);
      if (selectedRequestedDays.length !== visitsPerWeek) {
        return `Debes seleccionar exactamente ${visitsPerWeek} días solicitados por el atleta.`;
      }

      if (formData.selectedSlotIds.length !== visitsPerWeek) {
        return `Debes seleccionar exactamente ${visitsPerWeek} cupos semanales.`;
      }

      return null;
    }

    return null;
  };

  const goToStep = (stepId) => {
    if (stepId <= activeStep) {
      setActiveStep(stepId);
      return;
    }

    if (stepId === 2) {
      const error = validateStep(1);
      if (error) {
        alert(error);
        return;
      }
    }

    if (stepId === 3) {
      const error = validateStep(2);
      if (error) {
        alert(error);
        return;
      }
    }

    setActiveStep(stepId);
  };

  const handleNextStep = () => {
    const error = validateStep(activeStep);
    if (error) {
      alert(error);
      return;
    }

    setActiveStep((prev) => Math.min(prev + 1, 3));
  };

  const handlePrevStep = () => {
    setActiveStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateStep(3);
    if (validationError) {
      alert(validationError);
      return;
    }

    setLoading(true);

    try {
      const cleanDni = formData.dni.trim().replace(/\D/g, "");

      const visitsPerWeek = Number(formData.visitsPerWeek);

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
        coach_id: null,
        plan_option: null,
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

  const renderStepOne = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-6">
      <section className="xl:col-span-2">
        <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
          <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-500 flex items-center justify-center">
            <Icon name="User" size={12} />
          </div>
          <h3 className="text-sm font-black text-slate-800">Datos del Atleta</h3>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="space-y-5">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div>
              <label className={labelClasses}>Email</label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="nombre@email.com"
                className={inputClasses}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                placeholder="Apto físico, alergias, lesiones..."
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white/60 text-amber-900 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 placeholder:text-amber-700/50 transition-all resize-none text-sm font-medium"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderStepTwo = () => (
    <section>
      <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
        <div className="w-6 h-6 rounded bg-violet-50 text-violet-500 flex items-center justify-center">
          <Icon name="CreditCard" size={12} />
        </div>
        <h3 className="text-sm font-black text-slate-800">Membresía Inicial</h3>
      </div>

      <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
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
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClasses}>
              Frecuencia <span className="text-rose-500">*</span>
            </label>
            <select
              name="visitsPerWeek"
              value={formData.visitsPerWeek}
              onChange={handleChange}
              disabled={!formData.planId || availableVisitOptions.length === 0}
              className={`${inputClasses} appearance-none cursor-pointer bg-white disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {!formData.planId ? (
                <option value="">Plan primero</option>
              ) : availableVisitOptions.length === 0 ? (
                <option value="">Sin frecuencias</option>
              ) : (
                availableVisitOptions.map((value) => (
                  <option key={value} value={value}>
                    {getVisitsLabel(value)}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>Monto Inicial</label>
            <div className="h-[44px] rounded-xl border border-slate-200 bg-slate-100/70 px-3 flex items-center text-sm font-black text-slate-700">
              {formData.amount !== "" ? formatCurrency(formData.amount) : "—"}
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

        {selectedPlan && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
            <p className="text-[11px] font-black text-blue-800 uppercase tracking-widest">
              Resumen actual
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full bg-white border border-blue-100 text-xs font-bold text-blue-700">
                {selectedPlan.name}
              </span>
              {formData.visitsPerWeek && (
                <span className="px-3 py-1.5 rounded-full bg-white border border-blue-100 text-xs font-bold text-blue-700">
                  {getVisitsLabel(formData.visitsPerWeek)}
                </span>
              )}
              {formData.amount !== "" && (
                <span className="px-3 py-1.5 rounded-full bg-white border border-blue-100 text-xs font-bold text-blue-700">
                  {formatCurrency(formData.amount)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );

  const renderStepThree = () => (
    <section>
      <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
        <div className="w-6 h-6 rounded bg-sky-50 text-sky-500 flex items-center justify-center">
          <Icon name="CalendarDays" size={12} />
        </div>
        <h3 className="text-sm font-black text-slate-800">
          Disponibilidad Semanal
        </h3>
      </div>

      <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-4 space-y-5">
        {/* Días solicitados */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Días solicitados por el atleta
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Seleccioná exactamente{" "}
                <span className="font-black">
                  {Number(formData.visitsPerWeek || 0)}
                </span>{" "}
                día{Number(formData.visitsPerWeek || 0) === 1 ? "" : "s"} de
                preferencia.
              </p>
            </div>

            <span className="text-xs font-black text-slate-500">
              {selectedRequestedDays.length}/{Number(formData.visitsPerWeek || 0)}
            </span>
          </div>

          {requestableDays.length === 0 ? (
            <p className="text-xs text-slate-400">
              Este plan no tiene días habilitados.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {requestableDays.map((day) => {
                const selected = selectedRequestedDays.includes(day.dayIndex);
                const disabled =
                  day.disabled ||
                  (!selected &&
                    selectedRequestedDays.length >=
                      Number(formData.visitsPerWeek || 0));

                return (
                  <button
                    key={day.dayIndex}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleRequestedDay(day.dayIndex, day.disabled)}
                    className={`px-3 py-2 rounded-xl border text-sm font-bold transition-all ${
                      selected
                        ? "bg-blue-600 text-white border-blue-600"
                        : day.disabled
                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                        : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{day.day}</span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          selected
                            ? "bg-white/15 text-white"
                            : day.disabled
                            ? "bg-slate-200 text-slate-500"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {day.availableCount}/{day.totalSlots}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Matching */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="Sparkles" size={14} className="text-blue-500" />
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Mismo horario en varios días
            </p>
          </div>

          {!hasExactRequestedDays ? (
            <p className="text-xs text-slate-500">
              Primero seleccioná exactamente{" "}
              <span className="font-black">
                {Number(formData.visitsPerWeek || 0)}
              </span>{" "}
              día{Number(formData.visitsPerWeek || 0) === 1 ? "" : "s"} de
              preferencia para buscar horarios compatibles.
            </p>
          ) : compatibleTimeGroups.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-black text-amber-800 uppercase tracking-wider">
                Sin horarios compatibles
              </p>
              <p className="text-xs text-amber-700 mt-1">
                No encontramos un mismo horario disponible en todos los días
                elegidos. Podés cambiar los días o continuar con selección manual.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-3">
                Elegí una opción compatible y el sistema asignará automáticamente
                los cupos en esos días.
              </p>

              <div className="space-y-3">
                {compatibleTimeGroups.map((group) => {
                  const active = selectedSuggestedTimeKey === group.timeKey;

                  return (
                    <button
                      key={group.timeKey}
                      type="button"
                      onClick={() => applyCompatibleSchedule(group)}
                      className={`w-full text-left rounded-xl border p-3 transition-all ${
                        active
                          ? "border-blue-600 bg-blue-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-sm font-black text-slate-800">
                            Horario {group.label}
                          </p>
                          <p className="text-[11px] text-slate-500 font-semibold mt-1">
                            Compatible con los {group.slots.length} días elegidos
                          </p>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                            active
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {group.minRemaining} libres mín.
                        </span>
                      </div>

                      <div className="mt-3 space-y-1">
                        {group.slots.map((slot) => (
                          <div
                            key={slot.weekly_schedule_id}
                            className="text-xs font-medium text-slate-600"
                          >
                            {slot.dayLabel} · {slot.timeLabel}
                          </div>
                        ))}
                      </div>
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

            <div className="mt-3">
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs font-bold text-emerald-800 hover:text-rose-600 transition-colors"
              >
                Limpiar selección
              </button>
            </div>
          </div>
        )}

        {/* Manual */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="MousePointerClick" size={14} className="text-slate-500" />
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Selección manual por día
            </p>
          </div>

          {!hasExactRequestedDays ? (
            <p className="text-xs text-slate-500">
              Seleccioná primero los días solicitados para continuar con la elección
              manual.
            </p>
          ) : manualGroupsByDay.length === 0 ? (
            <p className="text-xs text-slate-400">
              No hay días disponibles para mostrar.
            </p>
          ) : (
            <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
              {manualGroupsByDay.map((group) => (
                <div
                  key={group.dayIndex}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3"
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h4 className="text-sm font-black text-slate-700">
                      {group.day}
                    </h4>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {group.slots.length} turno{group.slots.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.slots.map((slot) => {
                      const maxSelected = Number(formData.visitsPerWeek || 0);
                      const disabled =
                        (slot.full && !slot.selected) ||
                        (!slot.selected &&
                          formData.selectedSlotIds.length >= maxSelected);

                      return (
                        <button
                          key={slot.weekly_schedule_id}
                          type="button"
                          disabled={disabled}
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
                              : slot.full
                              ? "Sin cupo"
                              : "Disponible"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 rounded-[2rem] w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Header */}
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
                Alta inicial con plan y asignación semanal
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

        {/* Tabs */}
        <div className="px-6 border-b border-slate-100 shrink-0">
          <div className="flex gap-8 overflow-x-auto">
            {STEPS.map((step) => {
              const isActive = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(step.id)}
                  className={`relative py-5 text-sm font-black uppercase tracking-wide whitespace-nowrap transition-colors ${
                    isActive
                      ? "text-slate-900"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {step.label}
                  {isActive && (
                    <span className="absolute left-0 right-0 bottom-0 h-[3px] rounded-full bg-blue-600" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <form
          id="add-athlete-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto p-6 custom-scrollbar flex-1"
        >
          {activeStep === 1 && renderStepOne()}
          {activeStep === 2 && renderStepTwo()}
          {activeStep === 3 && renderStepThree()}
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

            {activeStep > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Atrás
              </button>
            )}

            {activeStep < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5"
              >
                Siguiente
                <Icon name="ArrowRight" size={15} />
              </button>
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddAthleteModal;