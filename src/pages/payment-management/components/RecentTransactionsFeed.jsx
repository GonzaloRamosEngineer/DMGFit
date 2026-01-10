import React from 'react';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const RecentTransactionsFeed = ({ transactions }) => {
  const getPaymentIcon = (method) => {
    const icons = {
      efectivo: 'Banknote',
      tarjeta: 'CreditCard',
      transferencia: 'ArrowRightLeft'
    };
    return icons?.[method] || 'DollarSign';
  };

  const getPaymentColor = (method) => {
    const colors = {
      efectivo: 'text-secondary',
      tarjeta: 'text-primary',
      transferencia: 'text-accent'
    };
    return colors?.[method] || 'text-foreground';
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
            Transacciones Recientes
          </h3>
          <p className="text-sm text-muted-foreground">
            Actualizaciones en tiempo real
          </p>
        </div>
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
      </div>
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {transactions?.map((transaction) => (
          <div
            key={transaction?.id}
            className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-smooth"
          >
            <Image
              src={transaction?.athleteImage}
              alt={transaction?.athleteImageAlt}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {transaction?.athleteName}
                </p>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(transaction?.timestamp, { addSuffix: true, locale: es })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {transaction?.description}
              </p>
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-1 ${getPaymentColor(transaction?.method)}`}>
                  <Icon name={getPaymentIcon(transaction?.method)} size={14} />
                  <span className="text-xs font-medium capitalize">{transaction?.methodLabel}</span>
                </div>
                <span className="text-sm font-data font-semibold text-success">
                  +€{transaction?.amount?.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {transactions?.length === 0 && (
        <div className="py-12 text-center">
          <Icon name="Receipt" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-4" />
          <p className="text-muted-foreground">No hay transacciones recientes</p>
        </div>
      )}
    </div>
  );
};

export default RecentTransactionsFeed;