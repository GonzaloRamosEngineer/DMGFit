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

  // Formulario
  const [formData, setFormData] = useState({
    athleteId: '',
    amount: '',         // Se autocalcula si seleccionas deudas
    method: 'efectivo',
    concept: '',        // Se autocompleta
    paymentDate: new Date().toISOString().split('T')[0],
    isManualEntry: false // Para permitir cobros extra (ej: botella de agua)
  });

  // 1. Cargar Atletas
  useEffect(() => {
    const fetchAthletes = async () => {
      const { data } = await supabase
        .from('athletes')
        .select('id, profiles:profile_id(full_name, email)')
        .eq('status', 'active')
        .order('join_date', { ascending: false });
      
      if (data) {
        setAthletes(data.map(a => ({
          id: a.id,
          name: a.profiles?.full_name || 'Sin Nombre',
          email: a.profiles?.email
        })));
      }
    };
    fetchAthletes();
  }, []);

  // 2. Buscar Deudas cuando se selecciona un atleta
  useEffect(() => {
    const fetchDebts = async () => {
      if (!formData.athleteId) {
        setPendingDebts([]);
        return;
      }

      setFetchingDebts(true);
      try {
        // Buscamos pagos en estado 'pending' o 'overdue'
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('athlete_id', formData.athleteId)
          .in('status', ['pending', 'overdue'])
          .order('payment_date', { ascending: true }); // Los más viejos primero

        if (error) throw error;
        setPendingDebts(data || []);
        
        // Auto-seleccionar la deuda más vieja por defecto
        if (data && data.length > 0) {
           handleSelectDebt(data[0].id, data[0].amount, data[0].concept);
        } else {
           // Si no tiene deudas, activamos modo manual por defecto
           setFormData(prev => ({ ...prev, isManualEntry: true, concept: 'Pago vario', amount: '' }));
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

  // Lógica para seleccionar/deseleccionar deudas
  const handleSelectDebt = (debtId, debtAmount, debtConcept) => {
    setSelectedDebtIds(prev => {
      const isSelected = prev.includes(debtId);
      let newSelection;

      if (isSelected) {
        newSelection = prev.filter(id => id !== debtId);
      } else {
        newSelection = [...prev, debtId];
      }
      
      // Recalcular Total
      recalculateTotal(newSelection);
      return newSelection;
    });
  };

  const recalculateTotal = (currentSelectionIds) => {
    // Sumamos los montos de los IDs seleccionados
    const total = pendingDebts
      .filter(d => currentSelectionIds.includes(d.id))
      .reduce((sum, d) => sum + Number(d.amount), 0);
    
    // Generamos concepto automático
    const concepts = pendingDebts
      .filter(d => currentSelectionIds.includes(d.id))
      .map(d => d.concept)
      .join(" + ");

    setFormData(prev => ({
      ...prev,
      amount: total > 0 ? total : '',
      concept: concepts || 'Sin selección',
      isManualEntry: currentSelectionIds.length === 0 // Si no hay selección, permitir manual
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (formData.isManualEntry && selectedDebtIds.length === 0) {
        // CASO A: Pago Manual Nuevo (Ej: Agua, Gatorade, o cuota que no estaba generada)
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
        // CASO B: Pagando Deudas Existentes (UPDATE)
        // Actualizamos los registros existentes de 'pending' a 'paid'
        const { error } = await supabase
          .from('payments')
          .update({
            status: 'paid',
            method: formData.method,
            payment_date: formData.paymentDate
            // No cambiamos el monto ni el concepto original de la deuda, solo el estado
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

  // Filtrar atletas
  const filteredAthletes = athletes.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Caja / Cobros</h2>
            <p className="text-sm text-muted-foreground">Seleccione deudas pendientes o cree un cobro nuevo</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><Icon name="X" size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* 1. Selector de Atleta */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Atleta a cobrar *</label>
            {!formData.athleteId ? (
              <>
                <input 
                  type="text" 
                  placeholder="🔍 Buscar apellido..." 
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
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {athletes.find(a => a.id === formData.athleteId)?.name.charAt(0)}
                  </div>
                  <span className="font-bold text-foreground">
                    {athletes.find(a => a.id === formData.athleteId)?.name}
                  </span>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setFormData(prev => ({ ...prev, athleteId: '', amount: '', concept: '' }));
                    setPendingDebts([]);
                  }}
                  className="text-xs text-muted-foreground hover:text-error underline"
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* 2. Lista de Deudas (El corazón del cambio) */}
          {formData.athleteId && (
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className="text-sm font-medium text-foreground">Conceptos Pendientes</label>
                {fetchingDebts && <span className="text-xs text-muted-foreground animate-pulse">Buscando deudas...</span>}
              </div>

              {pendingDebts.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden divide-y divide-border bg-card">
                  {pendingDebts.map(debt => {
                    const isSelected = selectedDebtIds.includes(debt.id);
                    const isOverdue = debt.status === 'overdue';
                    return (
                      <div 
                        key={debt.id}
                        onClick={() => handleSelectDebt(debt.id, debt.amount, debt.concept)}
                        className={`p-3 cursor-pointer flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                          }`}>
                            {isSelected && <Icon name="Check" size={12} color="white" />}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {debt.concept}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Venc: {new Date(debt.payment_date).toLocaleDateString()}
                              {isOverdue && <span className="ml-2 text-error font-bold text-[10px] uppercase">Vencido</span>}
                            </p>
                          </div>
                        </div>
                        <span className={`font-mono font-bold ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                          ${debt.amount}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                 <div className="p-4 bg-muted/20 border border-dashed border-border rounded-lg text-center text-sm text-muted-foreground">
                   <Icon name="CheckCircle" size={24} className="mx-auto mb-2 opacity-50" />
                   Este atleta está al día. <br/>
                   <span className="text-xs">Puede ingresar un cobro manual abajo.</span>
                 </div>
              )}
            </div>
          )}

          {/* 3. Resumen y Confirmación */}
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
                    className={`w-full pl-7 pr-3 py-2 rounded-md font-bold text-lg bg-card border outline-none focus:ring-2 focus:ring-primary ${
                      selectedDebtIds.length > 0 ? 'text-primary border-primary/50' : 'text-foreground border-border'
                    }`}
                    placeholder="0.00"
                    // Si seleccionó deudas, bloqueamos la edición manual para evitar errores, salvo que deseleccione todo
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

            {/* Input de concepto solo visible si es manual */}
            {selectedDebtIds.length === 0 && (
              <Input 
                label="Concepto (Cobro Manual)" 
                name="concept" 
                value={formData.concept} 
                onChange={(e) => setFormData(prev => ({ ...prev, concept: e.target.value }))}
                placeholder="Ej: Agua, Toalla, Matrícula..."
              />
            )}
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