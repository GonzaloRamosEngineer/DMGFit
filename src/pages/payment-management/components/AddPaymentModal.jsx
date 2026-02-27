import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';

// --- UTILS & HELPERS ---
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0
  }).format(amount || 0);
};

const getCurrentMonthName = () => {
  const date = new Date();
  const month = date.toLocaleString('es-ES', { month: 'long' });
  return month.charAt(0).toUpperCase() + month.slice(1);
};

const getResolvedPlanPrice = (athlete) => {
  if (!athlete) return null;

  const tierPrice =
    athlete.planTierPrice !== undefined &&
    athlete.planTierPrice !== null &&
    athlete.planTierPrice !== ''
      ? Number(athlete.planTierPrice)
      : null;

  const basePrice =
    athlete.planPrice !== undefined &&
    athlete.planPrice !== null &&
    athlete.planPrice !== ''
      ? Number(athlete.planPrice)
      : null;

  if (Number.isFinite(tierPrice)) return tierPrice;
  if (Number.isFinite(basePrice)) return basePrice;
  return null;
};

const getPlanChargeConcept = (athlete) => {
  const planName = athlete?.planName || 'Plan';
  const visits = Number(athlete?.visitsPerWeek || 0);
  const monthName = getCurrentMonthName();

  if (visits > 0) {
    return `Cuota ${planName} - ${visits} ${visits === 1 ? 'vez' : 'veces'} por semana - ${monthName}`;
  }

  return `Cuota ${planName} - ${monthName}`;
};

const AddPaymentModal = ({ onClose, onSuccess, initialAthlete = null }) => {
  // --- ESTADOS GLOBALES ---
  const [loading, setLoading] = useState(false);
  const [fetchingDebts, setFetchingDebts] = useState(false);

  // --- DATOS MAESTROS ---
  const [athletes, setAthletes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // --- SELECCIÓN Y FLUJO ---
  const [selectedAthlete, setSelectedAthlete] = useState(initialAthlete);
  const [pendingDebts, setPendingDebts] = useState([]);
  const [selectedDebtIds, setSelectedDebtIds] = useState([]);

  // --- FORMULARIO DE PAGO ---
  const [formData, setFormData] = useState({
    amount: '',         // Monto Base (Precio de lista o tier del atleta)
    method: 'efectivo',
    concept: '',
    paymentDate: new Date().toISOString().split('T')[0],
  });

  // --- DESCUENTOS ---
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState('percent'); // 'percent' | 'fixed'
  const [discountValue, setDiscountValue] = useState('');

  const selectedAthleteResolvedPlanPrice = useMemo(
    () => getResolvedPlanPrice(selectedAthlete),
    [selectedAthlete]
  );

  // ----------------------------------------------------------------
  // 1. CARGA INICIAL DE ATLETAS (AJUSTADO PARA PRIORIZAR PLAN_TIER_PRICE)
  // ----------------------------------------------------------------
  useEffect(() => {
    // Si ya recibimos un atleta inicial, no necesitamos cargar la lista
    if (selectedAthlete) return;

    const fetchAthletes = async () => {
      try {
        const { data, error } = await supabase
          .from('athletes')
          .select(`
            id,
            status,
            plan_tier_price,
            visits_per_week,
            profiles ( full_name, email, avatar_url ),
            plans ( name, price )
          `)
          .eq('status', 'active')
          .order('join_date', { ascending: false });

        if (error) {
          console.error("Error cargando atletas:", error);
          return;
        }

        if (data) {
          const mappedAthletes = data.map((a) => {
            const profileData = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
            const planData = Array.isArray(a.plans) ? a.plans[0] : a.plans;

            return {
              id: a.id,
              name: profileData?.full_name || profileData?.email || 'Sin Nombre Registrado',
              avatar: profileData?.avatar_url,
              email: profileData?.email,
              planName: planData?.name || 'Sin Plan',
              planPrice: planData?.price ?? null,          // base legacy
              planTierPrice: a.plan_tier_price ?? null,    // precio real acordado
              visitsPerWeek: a.visits_per_week ?? null,
            };
          });

          setAthletes(mappedAthletes);
        }
      } catch (err) {
        console.error("Error inesperado:", err);
      }
    };

    fetchAthletes();
  }, [selectedAthlete]);

  // ----------------------------------------------------------------
  // 2. BUSCAR DEUDAS AL SELECCIONAR ATLETA
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!selectedAthlete) {
      setPendingDebts([]);
      return;
    }

    const fetchDebts = async () => {
      setFetchingDebts(true);

      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('athlete_id', selectedAthlete.id)
        .in('status', ['pending', 'overdue'])
        .order('payment_date', { ascending: true });

      setPendingDebts(data || []);
      setFetchingDebts(false);

      // Lógica inteligente: Si hay deuda, seleccionar la más vieja por defecto
      if (data && data.length > 0) {
        handleToggleDebt(data[0].id, data);
      } else {
        handleResetForm(); // Preparar para cobro manual limpio
      }
    };

    fetchDebts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAthlete]);

  // ----------------------------------------------------------------
  // 3. LÓGICA DE NEGOCIO
  // ----------------------------------------------------------------

  // Calcular Total Final con Descuento
  const getFinalTotal = () => {
    const base = parseFloat(formData.amount) || 0;
    if (!showDiscount || !discountValue) return base;

    const val = parseFloat(discountValue);
    let final = base;

    if (discountType === 'percent') {
      final = base - (base * (val / 100));
    } else {
      final = base - val;
    }

    return Math.max(0, final);
  };

  // Seleccionar/Deseleccionar Deuda
  const handleToggleDebt = (debtId, currentDebts = pendingDebts) => {
    const isSelected = selectedDebtIds.includes(debtId);
    const newSelection = isSelected
      ? selectedDebtIds.filter(id => id !== debtId)
      : [...selectedDebtIds, debtId];

    setSelectedDebtIds(newSelection);

    if (newSelection.length > 0) {
      const selectedItems = currentDebts.filter(d => newSelection.includes(d.id));
      const totalAmount = selectedItems.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const combinedConcept = selectedItems.map(d => d.concept).join(' + ');

      setFormData(prev => ({
        ...prev,
        amount: totalAmount,
        concept: combinedConcept
      }));

      setShowDiscount(false);
      setDiscountValue('');
    } else {
      handleResetForm();
    }
  };

  // Carga Rápida: Cobrar Plan Actual (PRIORIZA PLAN_TIER_PRICE)
  const handleLoadPlan = () => {
    const resolvedPrice = selectedAthleteResolvedPlanPrice;
    if (!resolvedPrice) return;

    setSelectedDebtIds([]);
    setShowDiscount(false);
    setDiscountValue('');

    setFormData(prev => ({
      ...prev,
      amount: resolvedPrice,
      concept: getPlanChargeConcept(selectedAthlete)
    }));
  };

  // Reiniciar formulario a manual
  const handleResetForm = () => {
    setFormData(prev => ({ ...prev, amount: '', concept: '' }));
    setSelectedDebtIds([]);
    setShowDiscount(false);
    setDiscountValue('');
  };

  // Enviar Pago
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const finalAmount = getFinalTotal();

    try {
      const payload = {
        amount: finalAmount, // Lo que realmente paga
        method: formData.method,
        payment_date: formData.paymentDate,
        status: 'paid',
        base_amount: parseFloat(formData.amount), // Precio original
        discount_value: showDiscount ? parseFloat(discountValue) : null,
        discount_type: showDiscount ? discountType : null
      };

      if (selectedDebtIds.length > 0) {
        // A) PAGANDO DEUDAS EXISTENTES
        const { error } = await supabase
          .from('payments')
          .update(payload)
          .in('id', selectedDebtIds);

        if (error) throw error;
      } else {
        // B) CREANDO NUEVO COBRO
        const { error } = await supabase
          .from('payments')
          .insert({
            ...payload,
            athlete_id: selectedAthlete.id,
            concept: formData.concept
          });

        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Error al procesar el pago: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrado optimizado para la búsqueda
  const filteredAthletes = useMemo(() => {
    if (!searchTerm) return [];
    return athletes.filter(a =>
      (a.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [athletes, searchTerm]);

  // ----------------------------------------------------------------
  // RENDER UI
  // ----------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-[1.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* HEADER */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Caja / Cobros</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {selectedAthlete ? 'Detalles del Pago' : 'Seleccionar Atleta'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

          {/* VISTA 1: BUSCADOR DE ATLETAS */}
          {!selectedAthlete ? (
            <div className="space-y-6">
              <div className="relative group">
                <Icon name="Search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Buscar atleta por nombre..."
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none text-lg font-bold text-slate-700 transition-all placeholder:font-medium placeholder:text-slate-400"
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Resultados</p>
                <div className="grid grid-cols-1 gap-2">
                  {filteredAthletes.map(athlete => {
                    const resolvedPrice = getResolvedPlanPrice(athlete);

                    return (
                      <button
                        key={athlete.id}
                        onClick={() => setSelectedAthlete(athlete)}
                        className="flex items-center gap-4 p-3 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-xl transition-all group text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-blue-200 group-hover:text-blue-700 shrink-0 overflow-hidden">
                          {athlete.avatar ? (
                            <img src={athlete.avatar} alt={athlete.name} className="w-full h-full object-cover" />
                          ) : (
                            athlete.name.charAt(0)
                          )}
                        </div>

                        <div className="flex-1">
                          <p className="font-bold text-slate-700 group-hover:text-blue-800">{athlete.name}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-400 group-hover:text-blue-500">
                              {athlete.planName || 'Sin Plan'}
                            </span>

                            {athlete.visitsPerWeek ? (
                              <span className="text-[10px] bg-blue-50 px-1.5 py-0.5 rounded text-blue-600 font-mono">
                                {athlete.visitsPerWeek}x/sem
                              </span>
                            ) : null}

                            {resolvedPrice ? (
                              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono group-hover:bg-blue-100 group-hover:text-blue-600">
                                ${resolvedPrice}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <Icon name="ChevronRight" size={16} className="text-slate-300 group-hover:text-blue-400" />
                      </button>
                    );
                  })}

                  {filteredAthletes.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <p>{searchTerm ? "No se encontraron atletas" : "Escribe para buscar..."}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (

            /* VISTA 2: FORMULARIO DE PAGO */
            <form onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-right-8 duration-300">

              {/* Tarjeta Atleta Seleccionado */}
              <div className="flex items-center justify-between bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-200 overflow-hidden">
                    {selectedAthlete.avatar ? (
                      <img src={selectedAthlete.avatar} alt={selectedAthlete.name} className="w-full h-full object-cover" />
                    ) : (
                      selectedAthlete.name?.charAt(0) || 'A'
                    )}
                  </div>

                  <div>
                    <p className="font-bold text-slate-800 leading-tight">{selectedAthlete.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-slate-500 font-medium">{selectedAthlete.planName}</p>

                      {selectedAthlete.visitsPerWeek ? (
                        <span className="text-[10px] bg-blue-100 px-1.5 py-0.5 rounded text-blue-700 font-mono">
                          {selectedAthlete.visitsPerWeek}x/sem
                        </span>
                      ) : null}

                      {selectedAthleteResolvedPlanPrice ? (
                        <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-slate-600 font-mono border border-blue-100">
                          {formatCurrency(selectedAthleteResolvedPlanPrice)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {!initialAthlete && (
                  <button
                    type="button"
                    onClick={() => { setSelectedAthlete(null); setSearchTerm(''); }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline px-2"
                  >
                    Cambiar
                  </button>
                )}
              </div>

              {/* Sección A: Deudas Pendientes */}
              {fetchingDebts ? (
                <div className="text-center py-4">
                  <Icon name="Loader" className="animate-spin mx-auto text-blue-500" />
                </div>
              ) : pendingDebts.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Deudas Pendientes</label>
                  <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100 divide-y divide-slate-100">
                    {pendingDebts.map(debt => {
                      const isSelected = selectedDebtIds.includes(debt.id);
                      return (
                        <div
                          key={debt.id}
                          onClick={() => handleToggleDebt(debt.id)}
                          className={`p-4 cursor-pointer flex items-center justify-between transition-colors ${isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-100'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                              {isSelected && <Icon name="Check" size={12} className="text-white" />}
                            </div>
                            <div>
                              <p className={`text-sm font-bold ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>{debt.concept}</p>
                              <p className="text-[10px] font-bold text-rose-500">
                                Vencimiento: {new Date(debt.payment_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-slate-700">
                            {formatCurrency(debt.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Sección B: Acciones Rápidas */}
              {selectedDebtIds.length === 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleLoadPlan}
                    disabled={!selectedAthleteResolvedPlanPrice}
                    className="p-3 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 hover:border-blue-400 transition-all text-center group disabled:opacity-50"
                  >
                    <Icon name="Calendar" className="mx-auto mb-1 text-slate-400 group-hover:text-blue-500" size={18} />
                    <span className="block text-xs font-bold text-slate-600">Cargar Plan Actual</span>
                    {selectedAthleteResolvedPlanPrice ? (
                      <span className="text-[10px] text-slate-400">
                        {formatCurrency(selectedAthleteResolvedPlanPrice)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Sin monto</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="p-3 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 hover:border-blue-400 transition-all text-center group"
                  >
                    <Icon name="Edit" className="mx-auto mb-1 text-slate-400 group-hover:text-blue-500" size={18} />
                    <span className="block text-xs font-bold text-slate-600">Entrada Manual</span>
                    <span className="text-[10px] text-slate-400">Productos / Otros</span>
                  </button>
                </div>
              )}

              {/* Sección C: Inputs Monetarios */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      readOnly={selectedDebtIds.length > 0}
                      placeholder="0"
                      className={`w-full pl-8 pr-3 py-3 rounded-xl border-2 outline-none font-bold text-lg transition-all ${
                        selectedDebtIds.length > 0
                          ? 'bg-slate-100 border-transparent text-slate-500'
                          : 'bg-slate-50 border-transparent focus:border-blue-500 text-slate-800'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Método</label>
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData(prev => ({ ...prev, method: e.target.value }))}
                    className="w-full px-3 py-[14px] bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-xl outline-none font-bold text-slate-700 text-sm appearance-none"
                  >
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="tarjeta">💳 Tarjeta</option>
                    <option value="transferencia">🏦 Transferencia</option>
                    <option value="mp">📱 MercadoPago</option>
                  </select>
                </div>
              </div>

              {/* Input Concepto */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Concepto</label>
                <input
                  type="text"
                  value={formData.concept}
                  onChange={(e) => setFormData(prev => ({ ...prev, concept: e.target.value }))}
                  readOnly={selectedDebtIds.length > 0}
                  placeholder="Descripción del pago..."
                  className={`w-full px-4 py-3 rounded-xl border-2 outline-none font-medium text-sm transition-all ${
                    selectedDebtIds.length > 0
                      ? 'bg-slate-100 border-transparent text-slate-500'
                      : 'bg-slate-50 border-transparent focus:border-blue-500 text-slate-700'
                  }`}
                />
              </div>

              {/* Toggle Descuento */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowDiscount(!showDiscount)}
                  className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Icon name={showDiscount ? 'MinusCircle' : 'PlusCircle'} size={14} />
                  {showDiscount ? 'Quitar Descuento' : 'Aplicar Descuento / Promo'}
                </button>

                {showDiscount && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-xl flex gap-3 animate-in slide-in-from-top-2 border border-blue-100">
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      className="bg-white border border-blue-200 rounded-lg px-2 py-2 text-xs font-bold text-blue-800 outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="percent">% (Porc.)</option>
                      <option value="fixed">$ (Fijo)</option>
                    </select>
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'percent' ? "Ej: 15" : "Ej: 500"}
                      className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-800 outline-none focus:ring-2 focus:ring-blue-200 placeholder:text-blue-300/70"
                    />
                  </div>
                )}
              </div>

              {/* FOOTER TOTAL Y ACTION */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total a Pagar</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-slate-900 tracking-tighter">
                      {formatCurrency(getFinalTotal())}
                    </p>
                    {showDiscount && discountValue && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-1.5 rounded">
                        Con descuento
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !formData.amount || Number(formData.amount) <= 0}
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all hover:translate-y-[-2px] active:translate-y-[0px]"
                >
                  {loading ? <Icon name="Loader" className="animate-spin" size={18} /> : <Icon name="Check" size={18} />}
                  Confirmar
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddPaymentModal;