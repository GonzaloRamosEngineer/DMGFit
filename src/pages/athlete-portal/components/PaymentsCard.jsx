import React from 'react';
import Icon from '../../../components/AppIcon';

const PaymentsCard = ({ payments }) => {
  const totalPaid = payments?.filter(p => p?.status === 'paid')?.reduce((sum, p) => sum + p?.amount, 0) || 0;
  const pendingPayments = payments?.filter(p => p?.status === 'pending')?.length || 0;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-heading font-semibold text-foreground">Mis Pagos</h2>
        <Icon name="CreditCard" size={24} color="var(--color-warning)" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-success/10 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Total Pagado</p>
          <p className="text-xl font-bold text-success">${totalPaid}</p>
        </div>
        <div className="p-3 bg-warning/10 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Pendientes</p>
          <p className="text-xl font-bold text-warning">{pendingPayments}</p>
        </div>
      </div>

      {payments && payments?.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Historial:</p>
          {payments?.slice(0, 5)?.map((payment) => (
            <div key={payment?.id} className="p-3 bg-muted/50 rounded-lg border border-border/50">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{payment?.concept}</p>
                  <p className="text-xs text-muted-foreground">{payment?.date}</p>
                </div>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                  payment?.status === 'paid' ?'bg-success/10 text-success' :'bg-warning/10 text-warning'
                }`}>
                  {payment?.status === 'paid' ? 'Pagado' : 'Pendiente'}
                </span>
              </div>
              <p className="text-lg font-bold text-foreground">${payment?.amount}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Icon name="CreditCard" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
          <p className="text-muted-foreground">No hay historial de pagos</p>
        </div>
      )}
    </div>
  );
};

export default PaymentsCard;