import React from 'react';
import Icon from '../../../components/AppIcon';

const PaymentHistory = ({ payments }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'text-success bg-success/10';
      case 'pending':
        return 'text-warning bg-warning/10';
      case 'overdue':
        return 'text-error bg-error/10';
      default:
        return 'text-muted-foreground bg-muted/10';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return 'CheckCircle';
      case 'pending':
        return 'Clock';
      case 'overdue':
        return 'AlertCircle';
      default:
        return 'Circle';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'paid':
        return 'Pagado';
      case 'pending':
        return 'Pendiente';
      case 'overdue':
        return 'Vencido';
      default:
        return 'Desconocido';
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {payments?.map((payment, index) => (
        <div 
          key={payment?.id}
          className="bg-muted/30 border border-border rounded-lg p-3 md:p-4 transition-smooth hover:bg-muted/50"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-3 mb-2 md:mb-3">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center ${getStatusColor(payment?.status)}`}>
                <Icon name={getStatusIcon(payment?.status)} size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm md:text-base font-medium text-foreground truncate">
                  {payment?.description}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {payment?.date}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3 sm:flex-shrink-0">
              <span className="text-base md:text-lg font-semibold text-foreground data-text whitespace-nowrap">
                ${payment?.amount}
              </span>
              <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment?.status)}`}>
                {getStatusLabel(payment?.status)}
              </span>
            </div>
          </div>

          {payment?.method && (
            <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
              <Icon name="CreditCard" size={14} />
              <span>Método: {payment?.method}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PaymentHistory;