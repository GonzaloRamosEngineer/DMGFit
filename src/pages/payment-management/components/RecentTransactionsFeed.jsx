import React from 'react';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';

// --- UTILS ---
const formatCurrency = (amount) => 
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', minimumFractionDigits: 0 }).format(amount);

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const diff = Math.floor((new Date() - new Date(timestamp)) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const getMethodStyle = (method) => {
  switch (method?.toLowerCase()) {
    case 'efectivo': return { icon: 'Banknote', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    case 'tarjeta': return { icon: 'CreditCard', color: 'text-blue-600', bg: 'bg-blue-50' };
    case 'transferencia': return { icon: 'ArrowRightLeft', color: 'text-purple-600', bg: 'bg-purple-50' };
    default: return { icon: 'DollarSign', color: 'text-slate-500', bg: 'bg-slate-50' };
  }
};

// --- SUB-COMPONENT ---
const TransactionItem = ({ transaction }) => {
  const style = getMethodStyle(transaction.method);
  
  return (
    <div className="group flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all duration-300 mb-3 last:mb-0">
      
      {/* Left: User & Info */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {transaction.athleteImage ? (
            <Image src={transaction.athleteImage} alt={transaction.athleteName} className="w-10 h-10 rounded-full object-cover shadow-sm" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Icon name="User" size={16} />
            </div>
          )}
          {/* Method Badge (Mini Icon) */}
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${style.bg}`}>
             <Icon name={style.icon} size={10} className={style.color} />
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-slate-800 leading-none mb-1 group-hover:text-blue-600 transition-colors">
            {transaction.athleteName || 'Desconocido'}
          </p>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
               {formatTimeAgo(transaction.timestamp)}
             </span>
             <span className="text-[10px] text-slate-300">•</span>
             <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
               {transaction.description}
             </span>
          </div>
        </div>
      </div>

      {/* Right: Amount */}
      <div className="text-right">
        <span className="block text-sm font-black text-slate-900 tracking-tight">
          +{formatCurrency(transaction.amount)}
        </span>
        <span className={`text-[9px] font-bold uppercase tracking-widest ${style.color}`}>
          {transaction.method}
        </span>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const RecentTransactionsFeed = ({ transactions = [], loading = false, mode = 'widget' }) => {
  
  if (loading) {
    return ( /* Skeleton Loader minimalista */
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-50 rounded-2xl"></div>)}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center opacity-60">
        <Icon name="Receipt" size={32} className="text-slate-300 mb-2" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin movimientos recientes</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${mode === 'table' ? 'p-0' : 'bg-white rounded-[2.5rem] border border-slate-100 p-6'}`}>
      
      {/* Header (Solo si es Widget, la tabla ya tiene header externo) */}
      {mode === 'widget' && (
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Últimos Pagos</h3>
          <button className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-widest">
            Ver Todo
          </button>
        </div>
      )}

      {/* Listado con Scroll suave */}
      <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
        {transactions.map((tx) => (
          <TransactionItem key={tx.id} transaction={tx} />
        ))}
      </div>
    </div>
  );
};

export default RecentTransactionsFeed;