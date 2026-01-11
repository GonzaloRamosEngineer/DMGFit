import React from 'react';
import Icon from '../../../components/AppIcon';

const PaymentHistory = ({ payments, loading = false }) => {
  
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
         {[1,2,3].map(i => <div key={i} className="h-20 bg-muted/30 rounded-lg"></div>)}
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'text-success bg-success/10';
      case 'pending': return 'text-warning bg-warning/10';
      case 'overdue': return 'text-error bg-error/10';
      default: return 'text-muted-foreground bg-muted/10';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return 'CheckCircle';
      case 'pending': return 'Clock';
      case 'overdue': return 'AlertCircle';
      default: return 'Circle';
    }
  };

  const getStatusLabel = (status) => {
    const labels = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido' };
    return labels[status] || 'Desconocido';
  };

  if (!payments || payments.length === 0) {
    return (
      <div className="text-center py-10 bg-muted/10 rounded-lg border border-dashed border-border">
        <Icon name="CreditCard" size={48} className="mx-auto mb-3 opacity-30" />
        <p className="text-muted-foreground">No hay historial de pagos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {payments.map((payment) => (
        <div 
          key={payment.id}
          className="bg-muted/30 border border-border rounded-lg p-3 md:p-4 transition-smooth hover:bg-muted/50"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-3 mb-2 md:mb-3">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center ${getStatusColor(payment.status)}`}>
                <Icon name={getStatusIcon(payment.status)} size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm md:text-base font-medium text-foreground truncate">
                  {payment.concept || payment.description || 'Pago sin concepto'}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {new Date(payment.payment_date || payment.date).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-3 sm:flex-shrink-0">
              <span className="text-base md:text-lg font-semibold text-foreground data-text whitespace-nowrap">
                €{payment.amount}
              </span>
              <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                {getStatusLabel(payment.status)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground border-t border-border/50 pt-2 mt-2">
            <Icon name="CreditCard" size={14} />
            <span>Método: <span className="capitalize">{payment.method || 'No especificado'}</span></span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PaymentHistory;