import React, { useState } from 'react';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';
import { EmptyState } from '../../../components/ui/EmptyState';

const OverduePaymentsTable = ({ 
  payments, 
  onSendReminder, 
  loading = false, 
  mode = 'full' // 'full' | 'compact'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayments, setSelectedPayments] = useState([]);

  // Filtrado interno
  const filteredPayments = payments?.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return p.athleteName?.toLowerCase().includes(term) || p.concept?.toLowerCase().includes(term);
  });

  // Selección masiva
  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedPayments(filteredPayments.map(p => p.id));
    else setSelectedPayments([]);
  };

  const handleSelectRow = (id) => {
    setSelectedPayments(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // Renderizado de Carga
  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        {[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-xl"></div>)}
      </div>
    );
  }

  // Renderizado Vacío
  if (!payments || payments.length === 0) {
    return (
      <EmptyState iconName="CheckCircle" title="Todo al día" />
    );
  }

  return (
    <div className={`bg-card overflow-hidden ${mode === 'full' ? '' : 'bg-transparent'}`}>

      {/* HEADER (Solo en modo Full) */}
      {mode === 'full' && (
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/30">
          <div className="relative w-full sm:w-64">
             <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
             <input
               type="text"
               placeholder="Buscar deudor..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-sm outline-none focus:border-primary transition-colors"
             />
          </div>

          {selectedPayments.length > 0 && (
            <button
              onClick={() => onSendReminder(selectedPayments)}
              className="flex items-center gap-2 px-4 py-2 bg-error text-error-foreground rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-error/90 transition-colors shadow-md"
            >
              <Icon name="Bell" size={14} />
              Recordar ({selectedPayments.length})
            </button>
          )}
        </div>
      )}

      {/* TABLE BODY */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {mode === 'full' && (
            <thead className="bg-muted text-xs font-black text-text-tertiary uppercase tracking-widest">
              <tr>
                <th className="p-4 w-10">
                  <input type="checkbox" onChange={handleSelectAll} className="rounded border-border text-primary focus:ring-0 cursor-pointer" />
                </th>
                <th className="p-4">Atleta</th>
                <th className="p-4">Deuda</th>
                <th className="p-4">Tiempo</th>
                <th className="p-4 text-right">Acción</th>
              </tr>
            </thead>
          )}
          
          <tbody className="divide-y divide-border">
            {filteredPayments.map((payment) => (
              <tr key={payment.id} className="group hover:bg-error-light/30 transition-colors">

                {/* Checkbox (Solo Full) */}
                {mode === 'full' && (
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedPayments.includes(payment.id)}
                      onChange={() => handleSelectRow(payment.id)}
                      className="rounded border-border text-error focus:ring-0 cursor-pointer"
                    />
                  </td>
                )}

                {/* Atleta Info */}
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {payment.athleteImage ? (
                      <Image src={payment.athleteImage} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-error-light flex items-center justify-center text-error font-bold text-xs">
                        {payment.athleteName?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-text-secondary leading-none">{payment.athleteName}</p>
                      <p className="text-[10px] text-text-tertiary mt-1 truncate max-w-[150px]">{payment.concept}</p>
                    </div>
                  </div>
                </td>

                {/* Monto */}
                <td className="p-4">
                  <span className="font-mono font-bold text-error">
                    ${Number(payment.amountOwed || payment.amount).toLocaleString()}
                  </span>
                </td>

                {/* Días Vencido */}
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide ${
                    payment.daysOverdue > 30 ? 'bg-error-light text-error' : 'bg-warning-light text-warning'
                  }`}>
                    <Icon name="Clock" size={10} />
                    {payment.daysOverdue} días
                  </span>
                </td>

                {/* Acciones Rápidas */}
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onSendReminder([payment.id])}
                      className="p-2 text-text-tertiary hover:text-primary hover:bg-info-light rounded-lg transition-colors"
                      title="Enviar WhatsApp"
                    >
                      <Icon name="MessageCircle" size={16} />
                    </button>
                    {/* Aquí iría la acción de cobrar */}
                    <button className="p-2 text-text-tertiary hover:text-success hover:bg-success-light rounded-lg transition-colors" title="Registrar Cobro">
                      <Icon name="DollarSign" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OverduePaymentsTable;