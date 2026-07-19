import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';

// Resumen compacto de la membresía para el Inicio del portal.
// El detalle completo (precio, vigencia, estado) vive en la sección Cuenta (MyPlanCard).
const MembershipSummaryCard = ({ plan, kioskRemaining }) => {
  const navigate = useNavigate();

  const allowed = kioskRemaining?.allowed ?? null;
  const remaining = kioskRemaining?.remaining ?? null;
  const hasAccessBalance = allowed != null && remaining != null;
  const consumed = hasAccessBalance ? Math.max(allowed - remaining, 0) : null;
  const pct = allowed ? Math.min(100, Math.round((consumed / allowed) * 100)) : 0;
  const renewalLabel = kioskRemaining?.period_end
    ? new Date(kioskRemaining.period_end + 'T00:00:00').toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })
    : null;
  const isActive = plan?.athlete_status === 'active';

  return (
    <div className="rounded-3xl bg-card border border-border shadow-sm p-5 md:p-6 flex flex-col justify-between min-h-[200px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1">
            Mi membresía
          </p>
          <h3 className="text-xl font-black text-text-primary tracking-tight truncate">
            {plan?.name || 'Sin plan activo'}
          </h3>
        </div>
        <div className="w-10 h-10 shrink-0 rounded-xl bg-info-light text-primary flex items-center justify-center">
          <Icon name="CreditCard" size={20} />
        </div>
      </div>

      {/* Accesos del mes */}
      <div className="mt-4">
        {hasAccessBalance ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-text-primary tracking-tight">{remaining}</span>
              <span className="text-xs font-bold text-text-secondary">de {allowed} accesos disponibles</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            {renewalLabel && (
              <p className="text-[11px] text-text-tertiary font-medium mt-2">
                Se renueva el {renewalLabel}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs font-bold text-text-secondary">
            {plan
              ? (isActive ? 'Membresía activa' : 'Membresía inactiva')
              : 'Cuando el staff active tu membresía la vas a ver acá.'}
          </p>
        )}
      </div>

      {/* Link a Cuenta */}
      <button
        type="button"
        onClick={() => navigate('/athlete-portal/cuenta')}
        className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-info-light text-primary text-xs font-black uppercase tracking-wider py-2.5 hover:bg-primary hover:text-primary-foreground transition-colors"
      >
        Ver mi cuenta
        <Icon name="ArrowRight" size={14} />
      </button>
    </div>
  );
};

export default MembershipSummaryCard;
