import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import QuickActionMenu from '../../../components/ui/QuickActionMenu';

const AthleteCard = ({
  athlete,
  onSelect,
  isSelected,
  loading = false,
  canEnable = false,
  onEnableAccount,
  onQuickPay,
  layout = "card"
}) => {
  const navigate = useNavigate();

  const getPaymentStatus = (status) => {
    switch (status) {
      case 'paid': return { color: 'bg-emerald-50 text-emerald-600 border-emerald-200', label: 'Pagado' };
      case 'pending': return { color: 'bg-amber-50 text-amber-600 border-amber-200', label: 'Pendiente' };
      case 'overdue': return { color: 'bg-rose-50 text-rose-600 border-rose-200', label: 'Vencido' };
      default: return { color: 'bg-slate-50 text-slate-500 border-slate-200', label: 'Desc.' };
    }
  };

  // GRID COMPACTO DEFINIDO (Debe coincidir con el index.jsx)
  const gridLayout = "grid-cols-[32px_minmax(150px,3fr)_minmax(110px,1.5fr)_minmax(100px,1.5fr)_90px_72px]";

  if (loading && layout === "table") {
    return (
      <div className={`grid ${gridLayout} gap-3 px-5 py-3 items-center animate-pulse`}>
        <div className="w-4 h-4 rounded bg-slate-200 mx-auto"></div>
        <div className="flex gap-3 items-center">
          <div className="w-9 h-9 rounded-xl bg-slate-200"></div>
          <div className="space-y-2 flex-1">
            <div className="h-3 bg-slate-200 rounded w-2/3"></div>
            <div className="h-2 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
        <div className="space-y-1.5"><div className="h-2 bg-slate-200 rounded w-1/2"></div><div className="h-2 bg-slate-200 rounded w-1/3"></div></div>
        <div className="space-y-1.5"><div className="h-2 bg-slate-200 rounded w-1/2"></div></div>
        <div className="h-5 bg-slate-200 rounded-lg w-16"></div>
        <div className="h-6 bg-slate-200 rounded-lg w-full"></div>
      </div>
    );
  }

  if (loading) return <div className="bg-white border border-slate-100 rounded-2xl p-6 animate-pulse h-24"></div>;

  const paymentStyle = getPaymentStatus(athlete.paymentStatus);

  if (layout === "table") {
    return (
      <div className={`grid ${gridLayout} gap-3 px-5 py-3 items-center transition-colors group ${isSelected ? 'bg-blue-50/30' : 'hover:bg-slate-50/80'}`}>
        
        {/* 1. Checkbox */}
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect?.(athlete.id)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer transition-colors"
          />
        </div>

        {/* 2. Atleta Info */}
        <div className="flex items-center gap-2.5 min-w-0 cursor-pointer" onClick={() => navigate(`/individual-athlete-profile/${athlete.id}`)}>
          <div className="relative flex-shrink-0">
            {athlete.profileImage ? (
              <Image src={athlete.profileImage} alt={athlete.name} className="w-9 h-9 rounded-xl object-cover shadow-sm group-hover:shadow transition-shadow" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                <Icon name="User" size={18} />
              </div>
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${athlete.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-slate-800 truncate group-hover:text-blue-600 transition-colors">{athlete.name}</h3>
            <p className="text-[10px] font-medium text-slate-400 truncate">{athlete.email}</p>
          </div>
        </div>

        {/* 3. Membresía */}
        <div className="flex flex-col justify-center min-w-0">
          <p className="text-xs font-bold text-slate-700 truncate">{athlete.planName}</p>
          <p className="text-[10px] font-medium text-slate-500 truncate">{athlete.planOption || '—'}</p>
          <p className="text-[10px] font-bold text-slate-400">${athlete.planPrice}</p>
        </div>

        {/* 4. Métricas Compactas */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Asist.</span>
            <span className="text-xs font-black text-slate-700">{athlete.attendanceRate}%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Score</span>
            <span className={`text-xs font-black ${athlete.performanceScore >= 80 ? 'text-emerald-500' : athlete.performanceScore < 50 ? 'text-rose-500' : 'text-slate-700'}`}>
              {athlete.performanceScore}
            </span>
          </div>
        </div>

        {/* 5. Estado de Pago */}
        <div className="min-w-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border truncate max-w-full ${paymentStyle.color}`}>
            {paymentStyle.label}
          </span>
        </div>

        {/* 6. Acciones */}
        <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
          {athlete.needsActivation && canEnable && (
            <button
              onClick={(e) => { e.stopPropagation(); onEnableAccount?.(athlete); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
              title="Habilitar Cuenta"
            >
              <Icon name="UserCheck" size={14} />
            </button>
          )}

          {athlete.paymentStatus !== 'paid' && (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickPay?.(athlete); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 shadow-sm transition-colors"
              title="Registrar Pago"
            >
              <Icon name="DollarSign" size={12} />
            </button>
          )}

          <div onClick={(e) => e.stopPropagation()}>
            <QuickActionMenu 
              entityId={athlete.id} 
              entityType="athlete" 
              availableActions={[
                { id: 'msg', label: 'Mensaje', icon: 'MessageSquare' },
                { id: 'edit', label: 'Editar', icon: 'Edit' }
              ]} 
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border rounded-2xl p-5 transition-all hover:shadow-md ${isSelected ? 'border-blue-500 shadow-sm' : 'border-slate-100'}`}>
      <div className="flex items-center justify-between">
         <p className="font-bold">{athlete.name}</p>
         <button onClick={() => navigate(`/individual-athlete-profile/${athlete.id}`)}>Ver más</button>
      </div>
    </div>
  );
};

export default AthleteCard;