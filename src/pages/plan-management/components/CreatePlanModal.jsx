import React, { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/AppIcon";
import { useToast } from "../../../hooks/useToast";

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const DAY_SHORT = ["D", "L", "M", "X", "J", "V", "S"];

const buildDefaultTiers = () =>
  [1, 2, 3, 4, 5].map((v) => ({
    visits_per_week: v,
    price: "",
  }));

const buildDefaultTimeBlock = () => ({
  start_time: "09:00",
  end_time: "13:00",
  capacity: 10,
  days: [1], // lunes
});

const timeToMinutes = (value = "") => {
  const [hh = "0", mm = "0"] = String(value).slice(0, 5).split(":");
  return Number(hh) * 60 + Number(mm);
};

const minutesToTime = (minutes) => {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

const normalizeWindows = (windows = []) => {
  return (windows || [])
    .map((window) => ({
      day_of_week: Number(window.day_of_week),
      start_time: String(window.start_time || "").slice(0, 5),
      end_time: String(window.end_time || "").slice(0, 5),
      capacity: Math.max(0, Number(window.capacity ?? 0)),
    }))
    .filter(
      (window) =>
        Number.isInteger(window.day_of_week) &&
        window.day_of_week >= 0 &&
        window.day_of_week <= 6 &&
        window.start_time &&
        window.end_time &&
        window.end_time > window.start_time,
    )
    .sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      if (a.start_time !== b.start_time)
        return a.start_time.localeCompare(b.start_time);
      if (a.end_time !== b.end_time)
        return a.end_time.localeCompare(b.end_time);
      return Number(a.capacity) - Number(b.capacity);
    });
};

const expandWindowsToSlots = (windows, sessionDurationMin = 60) => {
  const duration = Math.max(15, Number(sessionDurationMin) || 60);
  const slots = [];

  (windows || []).forEach((window) => {
    const day = Number(window.day_of_week);
    const start = timeToMinutes(window.start_time);
    const end = timeToMinutes(window.end_time);
    const capacity = Math.max(0, Number(window.capacity ?? 0));

    if (!Number.isInteger(day) || day < 0 || day > 6) return;
    if (!window.start_time || !window.end_time || end <= start) return;

    for (let cursor = start; cursor + duration <= end; cursor += duration) {
      slots.push({
        day_of_week: day,
        start_time: minutesToTime(cursor),
        end_time: minutesToTime(cursor + duration),
        capacity,
      });
    }
  });

  const unique = Array.from(
    new Map(
      slots.map((slot) => [
        `${slot.day_of_week}-${slot.start_time}-${slot.end_time}-${slot.capacity}`,
        slot,
      ]),
    ).values(),
  );

  return unique.sort(
    (a, b) =>
      a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time),
  );
};

const compressSlotsToWindows = (slots = [], sessionDurationMin = 60) => {
  if (!Array.isArray(slots) || slots.length === 0) return [];

  const normalized = slots
    .filter((slot) => slot.day_of_week !== undefined)
    .map((slot) => ({
      day_of_week: Number(slot.day_of_week),
      start_time: String(
        slot.start_time || slot.time?.split(" - ")?.[0] || "",
      ).slice(0, 5),
      end_time: String(
        slot.end_time || slot.time?.split(" - ")?.[1] || "",
      ).slice(0, 5),
      capacity: Number(slot.capacity || 0),
    }))
    .filter((slot) => slot.start_time && slot.end_time)
    .sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      if (a.capacity !== b.capacity) return a.capacity - b.capacity;
      return a.start_time.localeCompare(b.start_time);
    });

  const windows = [];
  const expectedStep = Math.max(15, Number(sessionDurationMin) || 60);

  for (const slot of normalized) {
    const last = windows[windows.length - 1];

    if (
      last &&
      last.day_of_week === slot.day_of_week &&
      Number(last.capacity) === Number(slot.capacity) &&
      timeToMinutes(last.end_time) === timeToMinutes(slot.start_time) &&
      timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time) ===
        expectedStep
    ) {
      last.end_time = slot.end_time;
    } else {
      windows.push({ ...slot });
    }
  }

  return windows;
};

const windowsToTimeBlocks = (windows = []) => {
  const grouped = new Map();

  normalizeWindows(windows).forEach((window) => {
    const key = `${window.start_time}-${window.end_time}-${window.capacity}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        start_time: window.start_time,
        end_time: window.end_time,
        capacity: Number(window.capacity || 0),
        days: [],
      });
    }

    grouped.get(key).days.push(Number(window.day_of_week));
  });

  const blocks = Array.from(grouped.values()).map((block) => ({
    ...block,
    days: Array.from(new Set(block.days)).sort((a, b) => a - b),
  }));

  return blocks.length > 0 ? blocks : [buildDefaultTimeBlock()];
};

const timeBlocksToWindows = (timeBlocks = []) => {
  const rawWindows = [];

  (timeBlocks || []).forEach((block) => {
    const start_time = String(block.start_time || "").slice(0, 5);
    const end_time = String(block.end_time || "").slice(0, 5);
    const capacity = Math.max(0, Number(block.capacity ?? 0));

    (block.days || []).forEach((dayIndex) => {
      rawWindows.push({
        day_of_week: Number(dayIndex),
        start_time,
        end_time,
        capacity,
      });
    });
  });

  const unique = Array.from(
    new Map(
      rawWindows.map((window) => [
        `${window.day_of_week}-${window.start_time}-${window.end_time}-${window.capacity}`,
        window,
      ]),
    ).values(),
  );

  return normalizeWindows(unique);
};

const CreatePlanModal = ({ plan, professors = [], onSave, onClose }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("identity");
  const [selectedFrequency, setSelectedFrequency] = useState("1");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "active",
    sessionDurationMin: 60,
    pricingTiers: buildDefaultTiers(),
    professorIds: [],
    features: [],
    price: 0, // compat legacy
    capacity: 0, // compat legacy
  });

  const [timeBlocks, setTimeBlocks] = useState([buildDefaultTimeBlock()]);
  // Ajustes por turno puntual (cupo personalizado / turno eliminado), sobre la franja base
  const [slotOverrides, setSlotOverrides] = useState({});

  useEffect(() => {
    if (!plan) {
      setFormData({
        name: "",
        description: "",
        status: "active",
        sessionDurationMin: 60,
        pricingTiers: buildDefaultTiers(),
        professorIds: [],
        features: [],
        price: 0,
        capacity: 0,
      });
      setTimeBlocks([buildDefaultTimeBlock()]);
      setActiveTab("identity");
      return;
    }

    const inferredDuration = Number(plan.sessionDurationMin || 60);

    const restoredWindows =
      Array.isArray(plan.availabilityWindows) &&
      plan.availabilityWindows.length > 0
        ? plan.availabilityWindows.map((window) => ({
            day_of_week: Number(window.day_of_week),
            start_time: String(window.start_time || "").slice(0, 5),
            end_time: String(window.end_time || "").slice(0, 5),
            capacity: Number(window.capacity || 0),
          }))
        : compressSlotsToWindows(plan.schedule || [], inferredDuration);

    setFormData({
      id: plan.id,
      name: plan.name || "",
      description: plan.description || "",
      status: plan.status || "active",
      sessionDurationMin: inferredDuration,
      pricingTiers:
        Array.isArray(plan.pricingTiers) && plan.pricingTiers.length > 0
          ? plan.pricingTiers.map((tier) => ({
              visits_per_week: Number(tier.visits_per_week),
              price: Number(tier.price),
            }))
          : buildDefaultTiers(),
      professorIds: Array.isArray(plan.professorIds) ? plan.professorIds : [],
      features: Array.isArray(plan.features) ? plan.features : [],
      price: Number(plan.price || 0),
      capacity: Number(plan.capacity || 0),
    });

    setTimeBlocks(windowsToTimeBlocks(restoredWindows));
    setActiveTab("identity");
  }, [plan]);

  const availabilityWindows = useMemo(() => {
    return timeBlocksToWindows(timeBlocks);
  }, [timeBlocks]);

  const generatedSlots = useMemo(() => {
    return expandWindowsToSlots(
      availabilityWindows,
      Number(formData.sessionDurationMin || 60),
    );
  }, [availabilityWindows, formData.sessionDurationMin]);

  const slotKey = (s) => `${s.day_of_week}-${s.start_time}-${s.end_time}`;

  // Aplica los ajustes por turno (cupo personalizado / eliminado) sobre los slots de la franja
  const applyOverrides = (slots) =>
    (slots || [])
      .map((s) => {
        const ov = slotOverrides[slotKey(s)];
        if (ov?.removed) return null;
        if (ov?.capacity != null && ov.capacity !== "")
          return { ...s, capacity: Math.max(0, Number(ov.capacity)) };
        return s;
      })
      .filter(Boolean);

  const effectiveSlots = useMemo(
    () => applyOverrides(generatedSlots),
    [generatedSlots, slotOverrides],
  );

  const generatedSlotsByDay = useMemo(() => {
    return DAYS.map((day, dayIndex) => ({
      day,
      dayIndex,
      slots: effectiveSlots.filter(
        (slot) => Number(slot.day_of_week) === dayIndex,
      ),
    })).filter((group) => group.slots.length > 0);
  }, [effectiveSlots]);

  const sortedPricingTiers = useMemo(() => {
    return [...(formData.pricingTiers || [])].sort(
      (a, b) => Number(a.visits_per_week) - Number(b.visits_per_week),
    );
  }, [formData.pricingTiers]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "sessionDurationMin" ? Number(value || 60) : value,
    }));
  };

  const toggleProfessor = (profId) => {
    setFormData((prev) => ({
      ...prev,
      professorIds: prev.professorIds.includes(profId)
        ? prev.professorIds.filter((id) => id !== profId)
        : [...prev.professorIds, profId],
    }));
  };

  const addTimeBlock = () => {
    setTimeBlocks((prev) => [
      ...prev,
      {
        start_time: "17:00",
        end_time: "21:00",
        capacity: 10,
        days: [],
      },
    ]);
  };

  const updateTimeBlock = (index, field, value) => {
    setTimeBlocks((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: field === "capacity" ? Number(value) : value,
      };
      return next;
    });
  };

  const toggleBlockDay = (blockIndex, dayIndex) => {
    setTimeBlocks((prev) => {
      const next = [...prev];
      const currentDays = Array.isArray(next[blockIndex].days)
        ? next[blockIndex].days
        : [];

      const exists = currentDays.includes(dayIndex);

      next[blockIndex] = {
        ...next[blockIndex],
        days: exists
          ? currentDays.filter((day) => day !== dayIndex)
          : [...currentDays, dayIndex].sort((a, b) => a - b),
      };

      return next;
    });
  };

  const removeTimeBlock = (index) => {
    setTimeBlocks((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [buildDefaultTimeBlock()];
    });
  };

  const handleTierChange = (visitsPerWeek, value) => {
    setFormData((prev) => ({
      ...prev,
      pricingTiers: prev.pricingTiers.map((tier) =>
        Number(tier.visits_per_week) === Number(visitsPerWeek)
          ? { ...tier, price: value === "" ? "" : Number(value) }
          : tier,
      ),
    }));
  };

  const addFrequency = () => {
    const nextVisits = Number(selectedFrequency);

    setFormData((prev) => {
      const exists = prev.pricingTiers.some(
        (tier) => Number(tier.visits_per_week) === nextVisits,
      );

      if (exists) return prev;

      return {
        ...prev,
        pricingTiers: [
          ...prev.pricingTiers,
          { visits_per_week: nextVisits, price: "" },
        ].sort((a, b) => a.visits_per_week - b.visits_per_week),
      };
    });
  };

  const removeTier = (visitsPerWeek) => {
    setFormData((prev) => {
      const next = prev.pricingTiers.filter(
        (tier) => Number(tier.visits_per_week) !== Number(visitsPerWeek),
      );

      return {
        ...prev,
        pricingTiers:
          next.length > 0 ? next : [{ visits_per_week: 1, price: "" }],
      };
    });
  };

  const validateIdentityTab = () => {
    if (!formData.name.trim()) {
      toast.error("Debes ingresar un nombre para el plan.");
      setActiveTab("identity");
      return false;
    }

    if (!formData.description.trim()) {
      toast.error("Debes ingresar una descripción.");
      setActiveTab("identity");
      return false;
    }

    return true;
  };

  const validateScheduleTab = () => {
    const normalizedWindows = normalizeWindows(availabilityWindows);
    const expandedSlots = expandWindowsToSlots(
      normalizedWindows,
      Number(formData.sessionDurationMin || 60),
    );

    if (normalizedWindows.length === 0) {
      toast.error("Debes configurar al menos una franja horaria válida con días seleccionados.");
      setActiveTab("schedule");
      return false;
    }

    if (expandedSlots.length === 0) {
      toast.error("No se generaron slots válidos. Revisa rangos horarios, duración y días.");
      setActiveTab("schedule");
      return false;
    }

    return true;
  };

  const validatePricingTab = () => {
    const normalizedPricingTiers = Array.from(
      new Map(
        (formData.pricingTiers || [])
          .map((tier) => ({
            visits_per_week: Number(tier.visits_per_week),
            price: Number(tier.price),
          }))
          .filter(
            (tier) =>
              tier.visits_per_week > 0 &&
              Number.isFinite(tier.price) &&
              tier.price >= 0,
          )
          .map((tier) => [tier.visits_per_week, tier]),
      ).values(),
    ).sort((a, b) => a.visits_per_week - b.visits_per_week);

    if (normalizedPricingTiers.length === 0) {
      toast.error("Debes configurar al menos un precio por frecuencia semanal.");
      setActiveTab("pricing");
      return false;
    }

    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateIdentityTab()) return;
    if (!validateScheduleTab()) return;
    if (!validatePricingTab()) return;

    const normalizedWindows = normalizeWindows(availabilityWindows);

    const normalizedPricingTiers = Array.from(
      new Map(
        (formData.pricingTiers || [])
          .map((tier) => ({
            visits_per_week: Number(tier.visits_per_week),
            price: Number(tier.price),
          }))
          .filter(
            (tier) =>
              tier.visits_per_week > 0 &&
              Number.isFinite(tier.price) &&
              tier.price >= 0,
          )
          .map((tier) => [tier.visits_per_week, tier]),
      ).values(),
    ).sort((a, b) => a.visits_per_week - b.visits_per_week);

    const expandedSlots = applyOverrides(
      expandWindowsToSlots(
        normalizedWindows,
        Number(formData.sessionDurationMin || 60),
      ),
    );

    const fallbackPrice = Number(normalizedPricingTiers[0]?.price || 0);
    const fallbackCapacity = Math.max(
      0,
      ...expandedSlots.map((slot) => Number(slot.capacity || 0)),
    );

    onSave({
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
      price: fallbackPrice,
      capacity: fallbackCapacity,
      pricingTiers: normalizedPricingTiers,
      scheduleSlots: expandedSlots,
      schedule: expandedSlots.map((slot) => ({
        day_of_week: slot.day_of_week,
        day: DAYS[slot.day_of_week] || "Día",
        start_time: slot.start_time,
        end_time: slot.end_time,
        capacity: slot.capacity,
        time: `${slot.start_time} - ${slot.end_time}`,
      })),
      availabilityWindows: normalizedWindows,
      sessionDurationMin: Number(formData.sessionDurationMin || 60),
      features: [],
    });
  };

  const inputClasses =
    "w-full px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 font-medium transition-all placeholder:text-text-tertiary";
  const labelClasses =
    "text-[11px] font-black text-text-secondary uppercase tracking-wider mb-2 block";
  const sectionCardClasses =
    "bg-card border border-border rounded-3xl p-5 md:p-6 shadow-sm";

  const tabButtonClasses = (tabKey) =>
    `pb-4 text-sm font-black border-b-[3px] transition-colors uppercase tracking-wide ${
      activeTab === tabKey
        ? "border-primary text-text-primary"
        : "border-transparent text-text-tertiary hover:text-text-secondary"
    }`;

  return (
    <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-modal flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-3xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
        {/* Header */}
        <div className="px-6 md:px-8 py-5 border-b border-border flex items-center justify-between shrink-0 bg-muted">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-error-light text-error flex items-center justify-center border border-border">
              <Icon name={plan ? "Edit" : "Plus"} size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-text-primary tracking-tight">
                {plan ? "Editar Plan" : "Crear Nuevo Plan"}
              </h2>
              <p className="text-sm font-medium text-text-secondary mt-0.5">
                Configurá la identidad, disponibilidad y precios.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-text-tertiary hover:bg-card hover:text-text-secondary transition-colors border border-border shadow-sm"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-card px-6 md:px-8 pt-4 gap-6 md:gap-10 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("identity")}
            className={tabButtonClasses("identity")}
          >
            1. Identidad
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("schedule")}
            className={tabButtonClasses("schedule")}
          >
            2. Horarios por Día
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pricing")}
            className={tabButtonClasses("pricing")}
          >
            3. Precios
          </button>
        </div>

        <form
          id="plan-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 bg-muted/70 custom-scrollbar"
        >
          <div className="p-4 md:p-8 space-y-6">
            {/* TAB 1: IDENTIDAD */}
            {activeTab === "identity" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className={sectionCardClasses}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <label className={labelClasses}>
                        Nombre Comercial{" "}
                        <span className="text-error">*</span>
                      </label>
                      <input
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Ej: Plan Fuerza Base"
                        required
                        autoFocus
                        className={inputClasses}
                      />
                    </div>

                    <div>
                      <label className={labelClasses}>Estado Inicial</label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className={`${inputClasses} appearance-none cursor-pointer`}
                      >
                        <option value="active">🟢 Activo (Visible)</option>
                        <option value="inactive">⚪ Inactivo (Oculto)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className={labelClasses}>
                      Descripción del enfoque{" "}
                      <span className="text-error">*</span>
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Describe brevemente qué se trabaja en este plan..."
                      rows={4}
                      className={`${inputClasses} resize-none`}
                      required
                    />
                  </div>
                </div>

                <div className={sectionCardClasses}>
                  <label className={labelClasses}>
                    Profesores a cargo (selección múltiple)
                  </label>

                  <div className="flex flex-wrap gap-3">
                    {professors.length > 0 ? (
                      professors.map((prof) => {
                        const isSelected = formData.professorIds.includes(
                          prof.id,
                        );

                        return (
                          <button
                            key={prof.id}
                            type="button"
                            onClick={() => toggleProfessor(prof.id)}
                            className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all shadow-sm ${
                              isSelected
                                ? "border-error/30 bg-error-light text-error"
                                : "border-border bg-card text-text-secondary hover:bg-muted"
                            }`}
                          >
                            {isSelected ? `✓ ${prof.name}` : prof.name}
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-sm text-text-tertiary font-medium py-3">
                        No hay profesores registrados.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: HORARIOS */}
            {activeTab === "schedule" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className={sectionCardClasses}>
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div className="min-w-0">
                      <h3 className="font-black text-text-primary uppercase tracking-wider text-sm">
                        Duración del Turno / Clase
                      </h3>
                      <p className="text-sm text-text-secondary mt-1">
                        Las franjas de abajo se cortarán en bloques de este
                        tiempo.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 lg:min-w-[230px] lg:justify-end">
                      <div className="w-[110px] sm:w-[120px]">
                        <input
                          name="sessionDurationMin"
                          type="number"
                          min="15"
                          step="15"
                          value={formData.sessionDurationMin}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-card border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:outline-none text-center text-3xl font-black text-text-primary shadow-sm"
                          required
                        />
                      </div>

                      <span className="text-base font-black text-text-secondary uppercase tracking-wide whitespace-nowrap">
                        Minutos
                      </span>
                    </div>
                  </div>
                </div>

                <div className={sectionCardClasses}>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-black text-text-primary uppercase tracking-wide">
                      Configuración de Franjas y Días
                    </label>

                    <button
                      type="button"
                      onClick={addTimeBlock}
                      className="text-error text-sm font-black hover:text-error flex items-center gap-1.5 bg-error-light px-3 py-2 rounded-xl border border-border transition-colors"
                    >
                      <Icon name="Plus" size={14} />
                      Añadir Franja
                    </button>
                  </div>

                  <div className="space-y-6">
                    {timeBlocks.map((block, index) => (
                      <div
                        key={index}
                        className="bg-card p-5 rounded-2xl border border-border shadow-sm"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-5">
                          <div className="md:col-span-4">
                            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1.5">
                              Hora Inicio
                            </label>
                            <input
                              type="time"
                              value={block.start_time}
                              onChange={(e) =>
                                updateTimeBlock(
                                  index,
                                  "start_time",
                                  e.target.value,
                                )
                              }
                              className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-lg font-black focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-card transition-colors"
                            />
                          </div>

                          <div className="md:col-span-4">
                            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1.5">
                              Hora Fin
                            </label>
                            <input
                              type="time"
                              value={block.end_time}
                              onChange={(e) =>
                                updateTimeBlock(
                                  index,
                                  "end_time",
                                  e.target.value,
                                )
                              }
                              className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-lg font-black focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-card transition-colors"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1.5">
                              Cupo (Personas)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={block.capacity}
                              onChange={(e) =>
                                updateTimeBlock(
                                  index,
                                  "capacity",
                                  e.target.value,
                                )
                              }
                              className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-lg font-black focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-card transition-colors"
                            />
                          </div>

                          <div className="md:col-span-1 flex items-end justify-end">
                            <button
                              type="button"
                              onClick={() => removeTimeBlock(index)}
                              className="w-11 h-11 flex items-center justify-center text-text-tertiary hover:text-error hover:bg-error-light rounded-xl transition-colors"
                              title="Eliminar franja"
                            >
                              <Icon name="Trash2" size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="bg-muted p-4 rounded-xl border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <span className="text-xs font-black text-text-secondary uppercase tracking-wider">
                            Aplica a los días:
                          </span>

                          <div className="flex flex-wrap gap-2">
                            {DAY_SHORT.map((shortLabel, dayIndex) => {
                              const active = (block.days || []).includes(
                                dayIndex,
                              );

                              return (
                                <button
                                  key={`${index}-${dayIndex}`}
                                  type="button"
                                  onClick={() =>
                                    toggleBlockDay(index, dayIndex)
                                  }
                                  className={`w-10 h-10 rounded-lg font-black text-sm border-2 transition-all ${
                                    active
                                      ? "border-error bg-error text-primary-foreground shadow-md scale-105"
                                      : "border-border bg-card text-text-secondary hover:bg-muted hover:text-text-secondary"
                                  }`}
                                  title={DAYS[dayIndex]}
                                >
                                  {shortLabel}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 rounded-2xl p-6 shadow-inner border border-slate-800">
                  <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                    <Icon
                      name="CalendarDays"
                      size={18}
                      className="text-yellow-400"
                    />
                    <h3 className="text-white font-black uppercase tracking-widest text-sm">
                      Vista Previa de Calendario
                    </h3>
                  </div>

                  {generatedSlotsByDay.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      Aún no hay slots válidos para mostrar.
                    </p>
                  ) : (
                    <div className="space-y-5">
                      {generatedSlotsByDay.map((group) => (
                        <div
                          key={group.dayIndex}
                          className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4"
                        >
                          <h4 className="text-white text-sm font-black uppercase tracking-wider mb-3">
                            {group.day}
                          </h4>

                          <div className="flex flex-wrap gap-2">
                            {group.slots.map((slot, idx) => {
                              const key = `${slot.day_of_week}-${slot.start_time}-${slot.end_time}`;
                              return (
                              <span
                                key={`${group.dayIndex}-${slot.start_time}-${slot.end_time}-${idx}`}
                                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-black text-white flex items-center gap-2"
                              >
                                <span>
                                  {slot.start_time} - {slot.end_time}
                                </span>
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 text-emerald-400 text-[10px] uppercase tracking-widest">
                                  Cupo:
                                  <input
                                    type="number"
                                    min="0"
                                    value={slot.capacity}
                                    onChange={(e) =>
                                      setSlotOverrides((prev) => ({
                                        ...prev,
                                        [key]: { ...prev[key], capacity: e.target.value },
                                      }))
                                    }
                                    className="w-12 bg-transparent text-emerald-300 text-center outline-none border-b border-slate-600 focus:border-emerald-400"
                                  />
                                </span>
                                <button
                                  type="button"
                                  title="Eliminar este turno"
                                  onClick={() =>
                                    setSlotOverrides((prev) => ({
                                      ...prev,
                                      [key]: { ...prev[key], removed: true },
                                    }))
                                  }
                                  className="text-slate-500 hover:text-rose-400 transition-colors"
                                >
                                  <Icon name="X" size={12} />
                                </button>
                              </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: PRECIOS */}
            {activeTab === "pricing" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-info-light border border-border rounded-xl p-5 flex gap-4">
                  <div className="bg-info-light p-2 rounded-lg text-primary h-fit">
                    <Icon name="Wallet" size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-primary uppercase">
                      Configuración de Cobro
                    </h4>
                    <p className="text-sm text-text-secondary mt-1">
                      Agregá las frecuencias semanales que quieras ofrecer y
                      definí su valor mensual.
                    </p>
                  </div>
                </div>

                <div className={sectionCardClasses}>
                  <div className="flex flex-col sm:flex-row items-end gap-4">
                    <div>
                      <label className={labelClasses}>Frecuencia Semanal</label>
                      <select
                        value={selectedFrequency}
                        onChange={(e) => setSelectedFrequency(e.target.value)}
                        className="w-full sm:w-56 px-4 py-3 bg-muted border border-border rounded-xl text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary focus:outline-none transition-colors"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                          <option key={value} value={value}>
                            {value}{" "}
                            {value === 1 ? "Día por semana" : "Días por semana"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={addFrequency}
                      className="w-full sm:w-auto bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl font-black shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <Icon name="Plus" size={14} />
                      Añadir Frecuencia
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedPricingTiers.map((tier) => (
                    <div
                      key={tier.visits_per_week}
                      className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4"
                    >
                      <div className="min-w-[132px]">
                        <p className="text-lg font-black text-text-primary">
                          {tier.visits_per_week}{" "}
                          {Number(tier.visits_per_week) === 1
                            ? "Día / Sem"
                            : "Días / Sem"}
                        </p>
                      </div>

                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-black">
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={tier.price}
                          onChange={(e) =>
                            handleTierChange(
                              tier.visits_per_week,
                              e.target.value,
                            )
                          }
                          placeholder="Ej: 45000"
                          className="w-full pl-9 pr-4 py-3 bg-muted border border-border rounded-xl text-lg font-black focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-card transition-colors placeholder:text-text-tertiary"
                        />
                      </div>

                      {sortedPricingTiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTier(tier.visits_per_week)}
                          className="w-11 h-11 flex items-center justify-center text-text-tertiary hover:text-error hover:bg-error-light rounded-xl transition-colors shrink-0"
                          title="Eliminar frecuencia"
                        >
                          <Icon name="Trash2" size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 md:px-8 py-5 border-t border-border bg-card flex justify-between items-center shrink-0">
          <span className="text-xs font-bold text-text-tertiary uppercase tracking-widest">
            <span className="text-error">*</span> Obligatorio
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 font-black text-text-secondary hover:bg-muted rounded-xl transition-colors"
            >
              Cancelar
            </button>

            <button
              form="plan-form"
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-xl font-black shadow-md transition-all hover:-translate-y-0.5"
            >
              {plan ? "Guardar Cambios" : "Crear Plan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePlanModal;
