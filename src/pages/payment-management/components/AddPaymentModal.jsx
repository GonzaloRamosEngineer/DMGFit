import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const AddPaymentModal = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [athletes, setAthletes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    athleteId: '',
    amount: '',
    method: 'efectivo', // Default
    concept: 'Cuota Mensual',
    paymentDate: new Date().toISOString().split('T')[0]
  });

  // 1. Cargar lista de atletas activos al abrir
  useEffect(() => {
    const fetchAthletes = async () => {
      try {
        const { data, error } = await supabase
          .from('athletes')
          .select('id, profiles:profile_id(full_name, email)')
          .eq('status', 'active') // Solo activos
          .order('join_date', { ascending: false });
        
        if (error) throw error;

        if (data) {
          setAthletes(data.map(a => ({
            id: a.id,
            name: a.profiles?.full_name || 'Sin Nombre',
            email: a.profiles?.email
          })));
        }
      } catch (err) {
        console.error("Error cargando atletas:", err);
      }
    };
    fetchAthletes();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.athleteId) return alert("Por favor seleccione un atleta.");

    setLoading(true);
    try {
      // Insertar el pago
      const { error } = await supabase.from('payments').insert({
        athlete_id: formData.athleteId,
        amount: formData.amount,
        method: formData.method,
        concept: formData.concept,
        payment_date: formData.paymentDate,
        status: 'paid' // Si lo registramos manualmente, asumimos que ya pagó
      });

      if (error) throw error;

      // Éxito
      alert("Pago registrado correctamente.");
      onSuccess(); // Avisar al padre para que recargue la tabla
      onClose(); // Cerrar modal

    } catch (error) {
      console.error("Error:", error);
      alert("Error registrando pago: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrado simple para el buscador
  const filteredAthletes = athletes.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.email && a.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Registrar Nuevo Pago</h2>
            <p className="text-sm text-muted-foreground">Ingrese los detalles del cobro</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Formulario con Scroll si es necesario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* Buscador y Selector de Atleta */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Atleta *</label>
            <input 
              type="text" 
              placeholder="🔍 Buscar por nombre..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm mb-2 focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
            />
            <div className="border border-border rounded-md max-h-40 overflow-y-auto bg-card">
              {filteredAthletes.length > 0 ? (
                filteredAthletes.map(ath => (
                  <div 
                    key={ath.id}
                    onClick={() => setFormData(prev => ({ ...prev, athleteId: ath.id }))}
                    className={`px-3 py-2 text-sm cursor-pointer transition-colors flex justify-between items-center ${
                      formData.athleteId === ath.id 
                        ? 'bg-primary/20 text-primary font-medium' 
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <span>{ath.name}</span>
                    {formData.athleteId === ath.id && <Icon name="Check" size={14} />}
                  </div>
                ))
              ) : (
                <div className="p-3 text-sm text-muted-foreground text-center">No se encontraron atletas</div>
              )}
            </div>
            {formData.athleteId && <p className="text-xs text-success">Atleta seleccionado</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Monto *" 
              name="amount" 
              type="number" 
              value={formData.amount} 
              onChange={handleChange} 
              required 
              placeholder="$ 0.00"
            />
            <Input 
              label="Fecha" 
              name="paymentDate" 
              type="date" 
              value={formData.paymentDate} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Método</label>
              <select 
                name="method" 
                value={formData.method} 
                onChange={handleChange}
                className="w-full h-10 px-3 bg-card border border-border rounded-md text-sm focus:ring-2 focus:ring-primary outline-none text-foreground"
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta Débito/Crédito</option>
                <option value="transferencia">Transferencia</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <Input 
              label="Concepto" 
              name="concept" 
              value={formData.concept} 
              onChange={handleChange} 
              placeholder="Ej: Cuota Enero"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="default" iconName="Check" loading={loading}>Confirmar Pago</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPaymentModal;