import React, { useMemo } from 'react';
import Icon from '../../../components/AppIcon';

// --- UTILS & CONFIG ---

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(dateString));
};

const getStatusStyle = (status) => {
  switch (status) {
    case 'paid':
      return {
        bg: 'bg-success-light', text: 'text-success', icon: 'Check', iconBg: 'bg-success', label: 'Pagado'
      };
    case 'pending':
      return {
        bg: 'bg-warning-light', text: 'text-warning', icon: 'Clock', iconBg: 'bg-warning', label: 'Pendiente'
      };
    case 'overdue':
      return {
        bg: 'bg-error-light', text: 'text-error', icon: 'AlertTriangle', iconBg: 'bg-error', label: 'Vencido'
      };
    default:
      return {
        bg: 'bg-muted', text: 'text-text-secondary', icon: 'HelpCircle', iconBg: 'bg-text-tertiary', label: status
      };
  }
};

// --- LOGIC HOOK ---

const usePaymentLogic = (payments) => {
  return useMemo(() => {
    if (!payments) return { stats: { total: 0, pendingCount: 0, pendingAmount: 0 }, history: [], nextDue: null };

    // Los pagos anulados (void) no se le muestran al atleta: es una corrección
    // administrativa, no parte de su historial financiero.
    const list = payments.filter(p => p.status !== 'void');

    // 1. Estadísticas
    const totalPaid = list
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    const pendingItems = list.filter(p => p.status === 'pending' || p.status === 'overdue');
    const pendingAmount = pendingItems.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    // 2. Próximo vencimiento (El pendiente más antiguo)
    const nextDue = pendingItems.sort((a, b) => new Date(a.date) - new Date(b.date))[0];

    // 3. Historial (Ordenado por fecha descendente)
    const history = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      stats: {
        total: totalPaid,
        pendingCount: pendingItems.length,
        pendingAmount
      },
      history,
      nextDue
    };
  }, [payments]);
};

// --- SUB-COMPONENTS ---

const PaymentRow = ({ payment }) => {
  const style = getStatusStyle(payment.status);
  
  return (
    <div className="group flex items-center justify-between p-4 bg-card hover:bg-muted border border-border rounded-2xl transition-all duration-300 hover:shadow-md hover:-translate-x-1 mb-3 last:mb-0">
      <div className="flex items-center gap-4">
        {/* Icon Box */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${style.bg} group-hover:scale-110 transition-transform`}>
          <Icon name={style.icon} size={18} className={style.text} />
        </div>
        
        {/* Info */}
        <div>
          <p className="text-sm font-bold text-text-primary">{payment.concept || 'Cuota Mensual'}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              {formatDate(payment.date)}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${style.bg} ${style.text}`}>
              {style.label}
            </span>
          </div>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right">
        <p className={`text-sm font-black tracking-tight ${payment.status === 'pending' ? 'text-warning' : 'text-text-primary'}`}>
          {formatCurrency(payment.amount)}
        </p>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const PaymentsCard = ({ payments }) => {
  const { stats, history, nextDue } = usePaymentLogic(payments);

  if (!payments || payments.length === 0) {
    return (
      <div className="bg-card rounded-3xl p-8 border border-border flex flex-col items-center justify-center text-center opacity-60 min-h-[200px]">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
           <Icon name="CreditCard" size={20} className="text-text-tertiary" />
        </div>
        <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest">Sin historial de pagos</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-3xl p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-border h-full flex flex-col relative overflow-hidden">

      {/* Header Visual */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <div className="p-2 bg-success-light rounded-xl text-success">
                <Icon name="DollarSign" size={20} />
             </div>
             <h2 className="text-xl font-black text-text-primary tracking-tight">Finanzas</h2>
          </div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[0.2em] pl-11 -mt-1">
            Historial de transacciones
          </p>
        </div>

        {/* Total Invested Pill */}
        <div className="text-right">
          <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mb-0.5">Inversión Total</p>
          <p className="text-lg font-black text-text-primary tracking-tighter">
            {formatCurrency(stats.total)}
          </p>
        </div>
      </div>

      {/* ACTION AREA: Next Payment (Solo si hay deuda) */}
      {nextDue && (
        <div className="mb-6 relative overflow-hidden rounded-2xl bg-warning-light border border-warning/20 p-5 shadow-sm">
           <div className="absolute right-0 top-0 -mt-4 -mr-4 w-24 h-24 bg-warning/30 rounded-full blur-2xl opacity-40"></div>

           <div className="flex items-center justify-between relative z-10">
              <div className="flex items-start gap-3">
                 <div className="p-2 bg-warning/15 rounded-full text-warning mt-1">
                    <Icon name="AlertCircle" size={18} />
                 </div>
                 <div>
                    <p className="text-xs font-black text-warning uppercase tracking-wide mb-0.5">Pago Pendiente</p>
                    <p className="text-sm font-bold text-text-primary">{nextDue.concept}</p>
                    <p className="text-[10px] text-warning mt-1 font-medium">Vence: {formatDate(nextDue.date)}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-xl font-black text-warning tracking-tighter">{formatCurrency(nextDue.amount)}</p>
                 <button className="mt-2 text-[10px] font-black uppercase bg-warning hover:bg-warning/90 text-warning-foreground px-3 py-1.5 rounded-lg transition-colors tracking-wide">
                    Pagar Ahora
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto pr-1 -mr-1 max-h-[350px] scrollbar-hide">
         <div className="flex items-center gap-2 mb-4 px-1">
            <Icon name="Clock" size={12} className="text-text-tertiary" />
            <h3 className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">Actividad Reciente</h3>
         </div>

         {history.map((payment) => (
           <PaymentRow key={payment.id || Math.random()} payment={payment} />
         ))}
      </div>

      {/* Footer Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none"></div>
    </div>
  );
};

export default PaymentsCard;