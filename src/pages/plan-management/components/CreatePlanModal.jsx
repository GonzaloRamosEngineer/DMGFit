import React, { useEffect, useMemo, useState } from "react";
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

const DEFAULT_TIERS = [1, 2, 3, 4, 5].map((v) => ({
  visits_per_week: v,
  price: "",
}));

const DEFAULT_WINDOW = {
  day_of_week: 1,
  start_time: "09:00",
  end_time: "13:00",
  capacity: 10,
};

const timeToMinutes = (value = "") => {
  const [hh = "0", mm = "0"] = String(value).slice(0, 5).split(":");
  return Number(hh) * 60 + Number(mm);
};

const minutesToTime = (minutes) => {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
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
      ])
    ).values()
  );

  return unique.sort(
    (a, b) =>
      a.day_of_week - b.day_of_week ||
      a.start_time.localeCompare(b.start_time)
  );
};

const compressSlotsToWindows = (slots = [], sessionDurationMin = 60) => {
  if (!Array.isArray(slots) || slots.length === 0) return [DEFAULT_WINDOW];

  const normalized = slots
    .filter((slot) => slot.day_of_week !== undefined)
    .map((slot) => ({
      day_of_week: Number(slot.day_of_week),
      start_time: String(slot.start_time || slot.time?.split(" - ")?.[0] || "").slice(0, 5),
      end_time: String(slot.end_time || slot.time?.split(" - ")?.[1] || "").slice(0, 5),
      capacity: Number(slot.capacity || 0),
    }))
    .filter((slot) => slot.start_time && slot.end_time)
    .sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      if (a.capacity !== b.capacity) return a.capacity - b.capacity;
      return a.start_time.localeCompare(b.start_time);
    });

  if (normalized.length === 0) return [DEFAULT_WINDOW];

  const windows = [];
  const expectedStep = Math.max(15, Number(sessionDurationMin) || 60);

  for (const slot of normalized) {
    const last = windows[windows.length - 1];

    if (
      last &&
      last.day_of_week === slot.day_of_week &&
      Number(last.capacity) === Number(slot.capacity) &&
      timeToMinutes(last.end_time) === timeToMinutes(slot.start_time) &&
      timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time) === expectedStep
    ) {
      last.end_time = slot.end_time;
    } else {
      windows.push({ ...slot });
    }
  }

  return windows.length > 0 ? windows : [DEFAULT_WINDOW];
};

const CreatePlanModal = ({ plan, professors, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "active",
    sessionDurationMin: 60,
    availabilityWindows: [DEFAULT_WINDOW],
    pricingTiers: DEFAULT_TIERS,
    professorIds: [],
    features: [],
    price: 0,     // compat legacy
    capacity: 0,  // compat legacy
  });

  useEffect(() => {
    if (!plan) return;

    const inferredDuration = Number(plan.sessionDurationMin || 60);
    const restoredWindows =
      Array.isArray(plan.availabilityWindows) && plan.availabilityWindows.length > 0
        ? plan.availabilityWindows.map((window) => ({
            day_of_week: Number(window.day_of_week),
            start_time: String(window.start_time || "").slice(0, 5),
            end_time: String(window.end_time || "").slice(0, 5),
            capacity: Number(window.capacity || 0),
          }))
        : compressSlotsToWindows(plan.schedule || [], inferredDuration);

    setFormData({
      name: plan.name || "",
      description: plan.description || "",
      status: plan.status || "active",
      sessionDurationMin: inferredDuration,
      availabilityWindows: restoredWindows.length > 0 ? restoredWindows : [DEFAULT_WINDOW],
      pricingTiers:
        Array.isArray(plan.pricingTiers) && plan.pricingTiers.length > 0
          ? plan.pricingTiers.map((tier) => ({
              visits_per_week: Number(tier.visits_per_week),
              price: Number(tier.price),
            }))
          : DEFAULT_TIERS,
      professorIds: plan.professorIds || [],
      features: plan.features || [],
      price: Number(plan.price || 0),
      capacity: Number(plan.capacity || 0),
      id: plan.id,
    });
  }, [plan]);

  const enabledDays = useMemo(() => {
    return Array.from(
      new Set(formData.availabilityWindows.map((window) => Number(window.day_of_week)))
    ).sort((a, b) => a - b);
  }, [formData.availabilityWindows]);

  const generatedSlots = useMemo(() => {
    return expandWindowsToSlots(
      formData.availabilityWindows,
      Number(formData.sessionDurationMin || 60)
    );
  }, [formData.availabilityWindows, formData.sessionDurationMin]);

  const generatedSlotsByDay = useMemo(() => {
    return DAYS.map((day, dayIndex) => ({
      day,
      dayIndex,
      slots: generatedSlots.filter((slot) => Number(slot.day_of_week) === dayIndex),
    })).filter((group) => group.slots.length > 0);
  }, [generatedSlots]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "sessionDurationMin"
          ? Number(value || 60)
          : value,
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

  const toggleDay = (dayIndex) => {
    setFormData((prev) => {
      const exists = prev.availabilityWindows.some(
        (window) => Number(window.day_of_week) === dayIndex
      );

      if (exists) {
        const nextWindows = prev.availabilityWindows.filter(
          (window) => Number(window.day_of_week) !== dayIndex
        );

        return {
          ...prev,
          availabilityWindows: nextWindows.length > 0 ? nextWindows : [DEFAULT_WINDOW],
        };
      }

      return {
        ...prev,
        availabilityWindows: [
          ...prev.availabilityWindows,
          {
            day_of_week: dayIndex,
            start_time: "09:00",
            end_time: "13:00",
            capacity: 10,
          },
        ],
      };
    });
  };

  const addWindow = (dayIndex) => {
    setFormData((prev) => ({
      ...prev,
      availabilityWindows: [
        ...prev.availabilityWindows,
        {
          day_of_week: dayIndex,
          start_time: "17:00",
          end_time: "21:00",
          capacity: 10,
        },
      ],
    }));
  };

  const updateWindow = (index, field, value) => {
    setFormData((prev) => {
      const next = [...prev.availabilityWindows];
      next[index] = {
        ...next[index],
        [field]:
          field === "day_of_week" || field === "capacity"
            ? Number(value)
            : value,
      };
      return { ...prev, availabilityWindows: next };
    });
  };

  const removeWindow = (index) => {
    setFormData((prev) => {
      const next = prev.availabilityWindows.filter((_, i) => i !== index);
      return {
        ...prev,
        availabilityWindows: next.length > 0 ? next : [DEFAULT_WINDOW],
      };
    });
  };

  const handleTierChange = (index, field, value) => {
    setFormData((prev) => {
      const next = [...prev.pricingTiers];
      next[index] = {
        ...next[index],
        [field]: Number(value),
      };
      return { ...prev, pricingTiers: next };
    });
  };

  const addTier = () => {
    setFormData((prev) => ({
      ...prev,
      pricingTiers: [...prev.pricingTiers, { visits_per_week: 1, price: 0 }],
    }));
  };

  const removeTier = (index) => {
    setFormData((prev) => ({
      ...prev,
      pricingTiers: prev.pricingTiers.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const normalizedWindows = (formData.availabilityWindows || [])
      .map((window) => ({
        day_of_week: Number(window.day_of_week),
        start_time: String(window.start_time || "").slice(0, 5),
        end_time: String(window.end_time || "").slice(0, 5),
        capacity: Math.max(0, Number(window.capacity || 0)),
      }))
      .filter(
        (window) =>
          Number.isInteger(window.day_of_week) &&
          window.day_of_week >= 0 &&
          window.day_of_week <= 6 &&
          window.start_time &&
          window.end_time &&
          window.end_time > window.start_time
      );

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
              tier.price >= 0
          )
          .map((tier) => [tier.visits_per_week, tier])
      ).values()
    ).sort((a, b) => a.visits_per_week - b.visits_per_week);

    const expandedSlots = expandWindowsToSlots(
      normalizedWindows,
      Number(formData.sessionDurationMin || 60)
    );

    if (!formData.name.trim()) {
      alert("Debes ingresar un nombre para el plan.");
      return;
    }

    if (!formData.description.trim()) {
      alert("Debes ingresar una descripción.");
      return;
    }

    if (normalizedWindows.length === 0) {
      alert("Debes configurar al menos una ventana horaria válida.");
      return;
    }

    if (expandedSlots.length === 0) {
      alert("No se generaron slots válidos. Revisa rangos y duración.");
      return;
    }

    if (normalizedPricingTiers.length === 0) {
      alert("Debes configurar al menos un precio por visitas semanales.");
      return;
    }

    const fallbackPrice = Number(normalizedPricingTiers[0]?.price || 0);
    const fallbackCapacity = Math.max(
      0,
      ...expandedSlots.map((slot) => Number(slot.capacity || 0))
    );

    onSave({
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
      price: fallbackPrice,      // compat con flujo actual
      capacity: fallbackCapacity, // compat con flujo actual
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
      // se deja también para futuro uso si luego querés persistir ventanas
      availabilityWindows: normalizedWindows,
      sessionDurationMin: Number(formData.sessionDurationMin || 60),
    });
  };

  const inputClasses =
    "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 font-medium transition-all placeholder:text-slate-400";
  const labelClasses =
    "text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-2 block";
  const sectionCardClasses =
    "bg-white border border-slate-100 rounded-[1.5rem] p-6 shadow-sm";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-50 border border-slate-200 rounded-[2rem] w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
        <div className="px-8 py-6 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/50">
              <Icon name={plan ? "Edit" : "PlusCircle"} size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                {plan ? "Editar Plan" : "Crear Nuevo Plan"}
              </h2>
              <p className="text-sm font-medium text-slate-400 mt-0.5">
                Configura disponibilidad, cupos y precios por frecuencia
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <form
          id="plan-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto p-4 md:p-8 custom-scrollbar flex-1 space-y-8"
        >
          {/* Identidad */}
          <div className={sectionCardClasses}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Icon name="FileText" size={16} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">
                Identidad del Plan
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-8">
                <label className={labelClasses}>
                  Nombre Comercial <span className="text-rose-500">*</span>
                </label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ej: Plan Elite"
                  required
                  className={inputClasses}
                  autoFocus
                />
              </div>
              <div className="md:col-span-4">
                <label className={labelClasses}>Estado</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className={`${inputClasses} appearance-none cursor-pointer`}
                >
                  <option value="active">🟢 Activo (Visible)</option>
                  <option value="inactive">🔴 Inactivo (Oculto)</option>
                </select>
              </div>
              <div className="md:col-span-12">
                <label className={labelClasses}>
                  Descripción <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe el enfoque del plan..."
                  rows={2}
                  className={`${inputClasses} resize-none`}
                  required
                />
              </div>
            </div>
          </div>

          {/* Duración + profesores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className={sectionCardClasses}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Icon name="Clock3" size={16} />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">
                  Duración de Sesión
                </h3>
              </div>

              <div>
                <label className={labelClasses}>
                  Duración (minutos) <span className="text-rose-500">*</span>
                </label>
                <input
                  name="sessionDurationMin"
                  type="number"
                  min="15"
                  step="15"
                  value={formData.sessionDurationMin}
                  onChange={handleInputChange}
                  className={inputClasses}
                  required
                />
                <p className="mt-2 text-xs text-slate-400 font-medium">
                  Ejemplo: 60 min generará slots de una hora dentro de cada rango.
                </p>
              </div>
            </div>

            <div className={sectionCardClasses}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                  <Icon name="Users" size={16} />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">
                  Profesores a Cargo
                </h3>
              </div>

              <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-100 max-h-[180px] overflow-y-auto custom-scrollbar">
                <div className="flex flex-wrap gap-2">
                  {professors.length > 0 ? (
                    professors.map((prof) => {
                      const isSelected = formData.professorIds.includes(prof.id);
                      return (
                        <button
                          key={prof.id}
                          type="button"
                          onClick={() => toggleProfessor(prof.id)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border ${
                            isSelected
                              ? "bg-violet-600 text-white border-violet-600 shadow-md"
                              : "bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50"
                          }`}
                        >
                          {isSelected && <Icon name="Check" size={12} />}
                          {prof.name}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-400 font-medium py-4 text-center w-full">
                      No hay profesores registrados.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Días */}
          <div className={sectionCardClasses}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Icon name="CalendarDays" size={16} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Días Habilitados</h3>
            </div>
          </section>

            <div className="flex flex-wrap gap-2">
              {DAYS.map((day, index) => {
                const active = enabledDays.includes(index);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(index)}
                    className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                      active
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ventanas */}
          <div className={sectionCardClasses}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <Icon name="CalendarRange" size={16} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">
                Ventanas Horarias y Cupos
              </h3>
            </div>

            <div className="space-y-6">
              {enabledDays.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Selecciona al menos un día habilitado.
                </p>
              ) : (
                enabledDays.map((dayIndex) => {
                  const windows = formData.availabilityWindows
                    .map((window, index) => ({ ...window, _index: index }))
                    .filter((window) => Number(window.day_of_week) === dayIndex);

                  return (
                    <div
                      key={dayIndex}
                      className="border border-slate-100 rounded-2xl p-4 bg-slate-50/70"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-black text-slate-700">
                          {DAYS[dayIndex]}
                        </h4>
                        <button
                          type="button"
                          onClick={() => addWindow(dayIndex)}
                          className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Icon name="Plus" size={12} />
                          Agregar ventana
                        </button>
                      </div>

                      <div className="space-y-3">
                        {windows.map((window) => (
                          <div
                            key={window._index}
                            className="grid grid-cols-12 gap-3 items-center bg-white p-3 rounded-xl border border-slate-100"
                          >
                            <div className="col-span-4">
                              <input
                                type="time"
                                value={window.start_time}
                                onChange={(e) =>
                                  updateWindow(window._index, "start_time", e.target.value)
                                }
                                className={inputClasses}
                              />
                            </div>
                            <div className="col-span-4">
                              <input
                                type="time"
                                value={window.end_time}
                                onChange={(e) =>
                                  updateWindow(window._index, "end_time", e.target.value)
                                }
                                className={inputClasses}
                              />
                            </div>
                            <div className="col-span-3">
                              <input
                                type="number"
                                min="0"
                                value={window.capacity}
                                onChange={(e) =>
                                  updateWindow(window._index, "capacity", e.target.value)
                                }
                                placeholder="Cupo"
                                className={`${inputClasses} text-center font-bold text-blue-600`}
                              />
                            </div>
                            <div className="col-span-1 flex justify-center">
                              <button
                                type="button"
                                onClick={() => removeWindow(window._index)}
                                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                              >
                                <Icon name="Trash2" size={18} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Preview */}
          <div className={sectionCardClasses}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
                <Icon name="LayoutGrid" size={16} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">
                Vista Previa de Slots Generados
              </h3>
            </div>

            {generatedSlotsByDay.length === 0 ? (
              <p className="text-sm text-slate-400">
                Aún no hay slots válidos para mostrar.
              </p>
            ) : (
              <div className="space-y-4">
                {generatedSlotsByDay.map((group) => (
                  <div key={group.dayIndex}>
                    <h4 className="text-sm font-black text-slate-700 mb-2">
                      {group.day}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {group.slots.map((slot, idx) => (
                        <span
                          key={`${group.dayIndex}-${slot.start_time}-${slot.end_time}-${idx}`}
                          className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600"
                        >
                          {slot.start_time} - {slot.end_time} · Cupo {slot.capacity}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className={sectionCardClasses}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
                  <Icon name="Layers" size={16} />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">
                  Precios por Visitas Semanales
                </h3>
              </div>
              <button
                type="button"
                onClick={addTier}
                className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <Icon name="Plus" size={12} />
                Añadir
              </button>
            </div>

            <div className="space-y-3">
              {formData.pricingTiers.map((tier, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <div className="relative w-1/3">
                    <input
                      type="number"
                      min="1"
                      max="7"
                      value={tier.visits_per_week}
                      onChange={(e) =>
                        handleTierChange(index, "visits_per_week", e.target.value)
                      }
                      className={`${inputClasses} pr-8`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Días
                    </span>
                  </div>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={tier.price}
                      onChange={(e) =>
                        handleTierChange(index, "price", e.target.value)
                      }
                      className={`${inputClasses} pl-8`}
                      placeholder="Precio"
                    />
                  </div>
                  {formData.pricingTiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(index)}
                      className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                    >
                      <Icon name="Trash2" size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </form>

        <div className="px-8 py-5 bg-white border-t border-slate-100 flex items-center justify-between shrink-0 z-10">
          <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest">
            <Icon name="Info" size={14} />
            Campos obligatorios <span className="text-rose-500 text-lg leading-none">*</span>
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              form="plan-form"
              type="submit"
              className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all hover:-translate-y-0.5"
            >
              <Icon name="Save" size={16} />
              {plan ? "Guardar Cambios" : "Crear Plan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePlanModal;
