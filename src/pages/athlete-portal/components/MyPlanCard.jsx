import React from 'react';
import Icon from '../../../components/AppIcon';

// --- UTILS & CONFIG ---

// Formateador de moneda
const formatCurrency = (amount) => {
  const value = Number(amount);

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
};

const STATUS_LABELS = {
  active: 'Membresía activa',
  inactive: 'Membresía inactiva',
  pending: 'Pendiente',
};

// --- MAIN COMPONENT ---

const MyPlanCard = ({ plan, kioskRemaining }) => {
  // Empty State
  if (!plan) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted p-8 min-h-[240px] flex flex-col items-center justify-center text-center">
        <Icon name="CreditCard" size={32} className="text-text-tertiary mb-3" />
        <h3 className="text-text-secondary font-bold text-sm">Sin plan activo</h3>
        <p className="mt-2 text-xs text-text-tertiary max-w-[220px] leading-relaxed">
          Cuando el staff active tu membresía, el detalle del plan va a aparecer acá.
        </p>
      </div>
    );
  }

  // Pre-calcular datos visuales
  const allowed = kioskRemaining?.allowed ?? null;
  const remaining = kioskRemaining?.remaining ?? null;
  const hasAccessBalance = allowed != null && remaining != null;
  const consumed = hasAccessBalance ? Math.max(allowed - remaining, 0) : null;
  const pct = allowed ? Math.min(100, Math.round((consumed / allowed) * 100)) : 0;
  const renewalLabel = kioskRemaining?.period_end
    ? new Date(kioskRemaining.period_end + 'T00:00:00').toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })
    : '—';
  const isActive = plan.athlete_status === 'active';
  const statusLabel = STATUS_LABELS[plan.athlete_status] || 'Plan registrado';
  const accessLabel = hasAccessBalance
    ? `${remaining} accesos disponibles`
    : statusLabel;
  const frequencyLabel = plan.visits_per_week
    ? `${plan.visits_per_week} veces por semana`
    : 'Frecuencia registrada';

  return (
    <div className="relative overflow-hidden rounded-3xl bg-card border border-border shadow-sm min-h-[280px] flex flex-col justify-between p-6 md:p-8">
      {/* Cinta superior con gradiente de marca */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-success" />

      <div className="flex flex-col h-full justify-between">
        {/* HEADER: Estado & Plan */}
        <div className="flex justify-between items-start">
          <div>
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border mb-3 ${
                isActive
                  ? 'bg-success-light text-success border-success/20'
                  : 'bg-muted text-text-secondary border-border'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-success' : 'bg-text-tertiary'}`} />
              {statusLabel}
            </span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-text-primary">
              {plan.name}
            </h2>
          </div>
          <div className="w-10 h-10 shrink-0 rounded-xl bg-info-light text-primary flex items-center justify-center">
            <Icon name="CreditCard" size={20} />
          </div>
        </div>

        {/* BODY: Saldo de accesos del período (real) */}
        <div className="mt-5">
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-2">
            Accesos este mes
          </p>
          <div className="bg-muted p-4 rounded-xl">
            {hasAccessBalance ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-text-primary tracking-tight">{remaining}</span>
                  <span className="text-xs font-bold text-text-secondary">de {allowed} disponibles</span>
                </div>
                <div className="mt-3 h-1.5 w-full bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-text-tertiary font-medium mt-2">
                  {consumed} usados en el período
                </p>
              </>
            ) : (
              <p className="text-xs font-bold text-text-secondary">{statusLabel}</p>
            )}
          </div>
        </div>

        {/* FOOTER: Vigencia & Precio */}
        <div className="flex items-end justify-between pt-4 border-t border-border mt-5">
          <div>
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-0.5">
              Vigencia
            </p>
            <div className="flex items-center gap-1.5 text-text-secondary">
              <Icon name="Calendar" size={13} />
              <span className="text-xs font-bold">{renewalLabel}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-2xl font-black text-text-primary tracking-tight">
                {formatCurrency(plan.price)}
              </span>
              <span className="text-[10px] font-bold text-text-tertiary uppercase">/mes</span>
            </div>
            <p className="text-[10px] text-success font-bold mt-1">{accessLabel}</p>
            <p className="text-[10px] text-text-tertiary font-medium mt-0.5">{frequencyLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPlanCard;
