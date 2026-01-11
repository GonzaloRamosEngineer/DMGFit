import React from 'react';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';

const RecentTransactionsFeed = ({ transactions, loading = false }) => {
  
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 h-full flex flex-col animate-pulse">
        <div className="h-6 bg-muted/50 rounded w-1/2 mb-6"></div>
        <div className="space-y-4 flex-1">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-10 h-10 bg-muted/50 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted/50 rounded w-3/4"></div>
                <div className="h-3 bg-muted/50 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getPaymentIcon = (method) => {
    const icons = {
      efectivo: 'Banknote',
      tarjeta: 'CreditCard',
      transferencia: 'ArrowRightLeft'
    };
    return icons[method?.toLowerCase()] || 'DollarSign';
  };

  const getPaymentColor = (method) => {
    const colors = {
      efectivo: 'text-secondary',
      tarjeta: 'text-primary',
      transferencia: 'text-accent'
    };
    return colors[method?.toLowerCase()] || 'text-foreground';
  };

  // Función helper para no depender de librerías externas en componentes UI simples
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Ahora mismo';
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} h`;
    return `Hace ${Math.floor(diffInSeconds / 86400)} d`;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
            Transacciones Recientes
          </h3>
          <p className="text-sm text-muted-foreground">Actualizaciones en tiempo real</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
      </div>
      
      <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1" style={{ maxHeight: '500px' }}>
        {transactions?.length > 0 ? (
          transactions.map((transaction) => (
            <div
              key={transaction?.id}
              className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-smooth"
            >
              <div className="flex-shrink-0 relative">
                {transaction?.athleteImage ? (
                  <Image
                    src={transaction.athleteImage}
                    alt={transaction.athleteName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Icon name="User" size={16} className="text-muted-foreground" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-card rounded-full p-0.5 border border-border">
                   <Icon name={getPaymentIcon(transaction?.method)} size={10} className={getPaymentColor(transaction?.method)} />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {transaction?.athleteName}
                  </p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimeAgo(transaction?.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                  {transaction?.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-1 ${getPaymentColor(transaction?.method)}`}>
                    <span className="text-xs font-medium capitalize">{transaction?.method || 'Pago'}</span>
                  </div>
                  <span className="text-sm font-data font-semibold text-success">
                    +${Number(transaction?.amount).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center">
            <Icon name="Receipt" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No hay transacciones recientes</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentTransactionsFeed;