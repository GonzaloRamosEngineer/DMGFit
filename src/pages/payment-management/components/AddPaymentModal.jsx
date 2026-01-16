import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const AddPaymentModal = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [fetchingDebts, setFetchingDebts] = useState(false);
  
  // Datos maestros
  const [athletes, setAthletes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado de Deudas del Atleta Seleccionado
  const [pendingDebts, setPendingDebts] = useState([]);
  const [selectedDebtIds, setSelectedDebtIds] = useState([]);

  // Información del atleta seleccionado (para saber su plan)
  const [selectedAthleteInfo, setSelectedAthleteInfo] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({
    athleteId: '',
    amount: '',         
    method: 'efectivo',
    concept: '',       
    paymentDate: new Date().toISOString().split('T')[0],
    isManualEntry: false 
  });

  // 1. Cargar Atletas CON SU PLAN
  useEffect(() => {
    const fetchAthletes = async () => {
      // OJO: Aquí agregamos 'plans:plan_id(name, price)' para saber cuánto cobra su plan
      const { data } = await supabase
        .from('athletes')
        .select(`
          id, 
          profiles:profile_id(full_name, email),
          plans:plan_id(name, price) 
        `)
        .eq('status', 'active')
        .order('join_date', { ascending: false });
      
      if (data) {
        setAthletes(data.map(a => ({
          id: a.id,
          name: a.profiles?.full_name || 'Sin Nombre',
          email: a.profiles?.email,
          planName: a.plans?.name,
          planPrice: a.plans?.price
        })));
      }
    };
    fetchAthletes();
  }, []);

  // 2. Buscar Deudas y Datos cuando se selecciona un atleta
  useEffect(() => {
    const fetchDebts = async () => {
      if (!formData.athleteId) {
        setPendingDebts([]);
        setSelectedAthleteInfo(null);
        return;
      }

      // Guardamos la info del atleta seleccionado para usarla en los botones
      const athleteInfo = athletes.find(a => a.id === formData.athleteId);
      setSelectedAthleteInfo(athleteInfo);

      setFetchingDebts(true);
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('athlete_id', formData.athleteId)
          .in('status', ['pending', 'overdue'])
          .order('payment_date', { ascending: true });

        if (error) throw error;
        setPendingDebts(data || []);
        
        // Si hay deuda vieja, sugerimos pagarla
        if (data && data.length > 0) {
           handleSelectDebt(data[0].id, data[0].amount, data[0].concept);
        } else {
           // Si NO hay deuda, preparamos para cobro manual limpio
           setFormData(prev => ({ ...prev, isManualEntry: true, concept: '', amount: '' }));
           setSelectedDebtIds([]);
        }

      } catch (err) {
        console.error("Error buscando deudas:", err);
      } finally {
        setFetchingDebts(false);
      }
    };

    fetchDebts();
  }, [formData.athleteId]);

  // Lógica para seleccionar/deseleccionar deudas existentes
  const handleSelectDebt = (debtId) => {
    setSelectedDebtIds(prev => {
      const isSelected = prev.includes(debtId);
      let newSelection = isSelected ? prev.filter(id => id !== debtId) : [...prev, debtId];
      
      recalculateTotal(newSelection);
      return newSelection;
    });
  };

  const recalculateTotal = (currentSelectionIds) => {
    const total = pendingDebts
      .filter(d => currentSelectionIds.includes(d.id))
      .reduce((sum, d) => sum + Number(d.amount), 0);
    
    const concepts = pendingDebts
      .filter(d => currentSelectionIds.includes(d.id))
      .map(d => d.concept)
      .join(" + ");

    setFormData(prev => ({
      ...prev,
      amount: total > 0 ? total : '',
      concept: concepts || '',
      isManualEntry: currentSelectionIds.length === 0
    }));
  };

  // --- NUEVA FUNCIÓN: CARGAR PLAN AUTOMÁTICAMENTE ---
  const handleLoadPlanCharge = () => {
    if (!selectedAthleteInfo?.planPrice) return alert("Este atleta no tiene un plan asignado con precio.");
    
    // Deseleccionamos cualquier deuda vieja para evitar mezclas raras
    setSelectedDebtIds([]); 
    
    // Obtenemos el mes actual en texto (Ej: "Febrero")
    const currentMonth = new Date().toLocaleString('es-ES', { month: 'long' });
    const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

    setFormData(prev => ({
      ...prev,
      isManualEntry: true, // Es un cobro nuevo
      amount: selectedAthleteInfo.planPrice,
      concept: `Cuota ${selectedAthleteInfo.planName} - ${capitalizedMonth}`
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (formData.isManualEntry && selectedDebtIds.length === 0) {
        // CASO A: Generando Cobro Nuevo (Plan Mensual o Manual)
        const { error } = await supabase.from('payments').insert({
          athlete_id: formData.athleteId,
          amount: formData.amount,
          method: formData.method,
          concept: formData.concept,
          payment_date: formData.paymentDate,
          status: 'paid'
        });
        if (error) throw error;

      } else {
        // CASO B: Pagando Deuda Vieja
        const { error } = await supabase
          .from('payments')
          .update({
            status: 'paid',
            method: formData.method,
            payment_date: formData.paymentDate
          })
          .in('id', selectedDebtIds);

        if (error) throw error;
      }

      alert("Pago registrado exitosamente");
      onSuccess();
      onClose();

    } catch (error) {
      console.error("Error:", error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtro buscador
  const filteredAthletes = athletes.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Caja / Cobros</h2>
            <p className="text-sm text-muted-foreground">Gestión de pagos y cuotas</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><Icon name="X" size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* 1. Selector de Atleta */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Atleta *</label>
            {!formData.athleteId ? (
              <>
                <input 
                  type="text" 
                  placeholder="🔍 Buscar por nombre..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm mb-2 focus:ring-2 focus:ring-primary outline-none"
                  autoFocus
                />
                <div className="border border-border rounded-md max-h-40 overflow-y-auto bg-card">
                  {filteredAthletes.map(ath => (
                    <div 
                      key={ath.id}
                      onClick={() => setFormData(prev => ({ ...prev, athleteId: ath.id }))}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-muted text-foreground flex justify-between"
                    >
                      <span>{ath.name}</span>
                      {ath.planName && <span className="text-xs text-muted-foreground bg-muted px-1 rounded">{ath.planName}</span>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {selectedAthleteInfo?.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-foreground block leading-tight">{selectedAthleteInfo?.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Plan: {selectedAthleteInfo?.planName || 'Sin Plan'} 
                      {selectedAthleteInfo?.planPrice ? ` ($${selectedAthleteInfo.planPrice})` : ''}
                    </span>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setFormData(prev => ({ ...prev, athleteId: '', amount: '', concept: '' }));
                    setPendingDebts([]);
                    setSelectedDebtIds([]);
                  }}
                  className="text-xs text-muted-foreground hover:text-error underline"
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* 2. Área de Selección de Pagos */}
          {formData.athleteId && (
            <div className="space-y-4 animate-in slide-in-from-top-2">
              
              {/* Opción A: Deudas Pendientes */}
              {pendingDebts.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Deudas Pendientes</label>
                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border bg-card">
                    {pendingDebts.map(debt => {
                      const isSelected = selectedDebtIds.includes(debt.id);
                      return (
                        <div 
                          key={debt.id}
                          onClick={() => handleSelectDebt(debt.id)}
                          className={`p-3 cursor-pointer flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                              {isSelected && <Icon name="Check" size={12} color="white" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{debt.concept}</p>
                              <p className="text-[10px] text-error">Vencido: {new Date(debt.payment_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <span className="font-mono font-bold">${debt.amount}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Opción B: Generar Nuevo Cobro (Botones Rápidos) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                   <label className="text-xs font-bold text-muted-foreground uppercase">Generar Cobro Nuevo</label>
                   {selectedDebtIds.length > 0 && <span className="text-[10px] text-warning">(Deseleccione deudas arriba para crear nuevo)</span>}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {/* BOTÓN MAGICO DE PLAN */}
                  <button
                    type="button"
                    onClick={handleLoadPlanCharge}
                    disabled={selectedDebtIds.length > 0 || !selectedAthleteInfo?.planPrice}
                    className="flex flex-col items-center justify-center p-3 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Icon name="Calendar" size={20} className="mb-1 text-primary" />
                    <span className="text-xs font-bold">Cobrar {selectedAthleteInfo?.planName || 'Plan'}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {selectedAthleteInfo?.planPrice ? `$${selectedAthleteInfo.planPrice}` : 'Sin precio'}
                    </span>
                  </button>

                  {/* Botón Manual */}
                  <button
                    type="button"
                    onClick={() => {
                        setSelectedDebtIds([]);
                        setFormData(prev => ({ ...prev, isManualEntry: true, amount: '', concept: '' }));
                    }}
                    disabled={selectedDebtIds.length > 0}
                    className="flex flex-col items-center justify-center p-3 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Icon name="Edit" size={20} className="mb-1 text-secondary" />
                    <span className="text-xs font-bold">Cobro Manual</span>
                    <span className="text-[10px] text-muted-foreground">Varios / Otros</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Resumen Final y Datos de Pago */}
          <div className="bg-muted/30 p-4 rounded-xl space-y-4 border border-border">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Total a Pagar</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value, isManualEntry: true }))}
                    className="w-full pl-7 pr-3 py-2 rounded-md font-bold text-lg bg-card border border-border outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                    // Solo editable si NO hay deudas seleccionadas (es manual)
                    readOnly={selectedDebtIds.length > 0} 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Método</label>
                <select 
                  name="method" 
                  value={formData.method} 
                  onChange={(e) => setFormData(prev => ({ ...prev, method: e.target.value }))}
                  className="w-full h-[46px] px-3 bg-card border border-border rounded-md text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="mp">MercadoPago</option>
                </select>
              </div>
            </div>

            {/* Concepto editable */}
            <Input 
              label="Concepto" 
              name="concept" 
              value={formData.concept} 
              onChange={(e) => setFormData(prev => ({ ...prev, concept: e.target.value }))}
              placeholder="Descripción del pago..."
              readOnly={selectedDebtIds.length > 0} // Bloqueado si son deudas viejas
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button 
              type="submit" 
              variant="default" 
              iconName="Check" 
              loading={loading}
              disabled={!formData.amount || Number(formData.amount) <= 0}
            >
              Confirmar Cobro
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPaymentModal;