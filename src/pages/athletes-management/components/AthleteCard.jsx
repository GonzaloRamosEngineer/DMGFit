import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Badge from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';

const AthleteCard = ({
  athlete,
  loading = false,
  canEnable = false,
  onEnableAccount,
  onQuickPay,
  layout = "card"
}) => {
  const navigate = useNavigate();

  const getPaymentStatus = (status) => {
    switch (status) {
      case 'paid': return { variant: 'success', label: 'Pagado' };
      case 'pending': return { variant: 'warning', label: 'Pendiente' };
      case 'overdue': return { variant: 'error', label: 'Vencido' };
      default: return { variant: 'neutral', label: 'Desc.' };
    }
  };

  // GRID COMPACTO DEFINIDO (Debe coincidir con el index.jsx)
  const gridLayout = "grid-cols-[minmax(150px,3fr)_minmax(110px,1.5fr)_minmax(100px,1.5fr)_90px_72px]";

  if (loading && layout === "table") {
    return (
      <div className={`grid ${gridLayout} gap-3 px-5 py-3 items-center`}>
        <div className="flex gap-3 items-center">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2 w-1/2" />
          </div>
        </div>
        <div className="space-y-1.5"><Skeleton className="h-2 w-1/2" /><Skeleton className="h-2 w-1/3" /></div>
        <div className="space-y-1.5"><Skeleton className="h-2 w-1/2" /></div>
        <Skeleton className="h-5 w-16 rounded-lg" />
        <Skeleton className="h-6 w-full rounded-lg" />
      </div>
    );
  }

  if (loading) return <div className="bg-card border border-border rounded-2xl p-6 animate-pulse h-24"></div>;

  const paymentStyle = getPaymentStatus(athlete.paymentStatus);

  if (layout === "table") {
    return (
      <div className={`grid ${gridLayout} gap-3 px-5 py-3 items-center transition-colors group hover:bg-muted/60`}>

        {/* 1. Atleta Info */}
        <div className="flex items-center gap-2.5 min-w-0 cursor-pointer" onClick={() => navigate(`/individual-athlete-profile/${athlete.id}`)}>
          <div className="relative flex-shrink-0">
            {athlete.profileImage ? (
              <Image src={athlete.profileImage} alt={athlete.name} className="w-9 h-9 rounded-xl object-cover shadow-sm group-hover:shadow transition-shadow" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-muted text-text-tertiary flex items-center justify-center border border-border group-hover:bg-info-light group-hover:text-primary transition-colors">
                <Icon name="User" size={18} />
              </div>
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${athlete.isActive ? 'bg-success' : 'bg-border'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-text-primary truncate group-hover:text-primary transition-colors">{athlete.name}</h3>
            <p className="text-[10px] font-medium text-text-tertiary truncate">{athlete.email}</p>
          </div>
        </div>

        {/* 2. Membresía */}
        <div className="flex flex-col justify-center min-w-0">
          <p className="text-xs font-bold text-text-secondary truncate">{athlete.planName}</p>
          <p className="text-[10px] font-medium text-text-secondary truncate">{athlete.planOption || '—'}</p>
          <p className="text-[10px] font-bold text-text-tertiary">${athlete.planPrice}</p>
        </div>

        {/* 3. Métricas Compactas */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Asist.</span>
            <span className="text-xs font-black text-text-secondary">{athlete.attendanceRate}%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Score</span>
            <span className={`text-xs font-black ${athlete.performanceScore >= 80 ? 'text-success' : athlete.performanceScore < 50 ? 'text-error' : 'text-text-secondary'}`}>
              {athlete.performanceScore}
            </span>
          </div>
        </div>

        {/* 4. Estado de Pago */}
        <div className="min-w-0">
          <Badge variant={paymentStyle.variant} size="sm">{paymentStyle.label}</Badge>
        </div>

        {/* 5. Acciones */}
        <div className="flex items-center justify-end gap-1">
          {/* Activación de cuenta por EMAIL desactivada: los atletas usan login por DNI
              (clave inicial = DNI). Ver scripts/activate-athletes.mjs y docs/plan-login-por-dni.md. */}

          {athlete.paymentStatus !== 'paid' && (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickPay?.(athlete); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-success-foreground bg-success hover:opacity-90 shadow-sm transition-opacity"
              title="Registrar Pago"
            >
              <Icon name="DollarSign" size={12} />
            </button>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/individual-athlete-profile/${athlete.id}`); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-tertiary hover:text-primary hover:bg-info-light transition-colors"
            title="Ver perfil"
          >
            <Icon name="ChevronRight" size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
         <p className="font-bold">{athlete.name}</p>
         <button onClick={() => navigate(`/individual-athlete-profile/${athlete.id}`)}>Ver más</button>
      </div>
    </div>
  );
};

export default AthleteCard;
