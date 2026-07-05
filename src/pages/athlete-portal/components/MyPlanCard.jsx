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
  // Empty State Premium
  if (!plan) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 min-h-[240px] flex flex-col items-center justify-center text-center border border-slate-800">
        <Icon name="CreditCard" size={32} className="text-slate-600 mb-3 opacity-50" />
        <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs">Sin Plan Activo</h3>
        <p className="mt-3 text-xs text-slate-500 max-w-[220px] leading-relaxed">
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
  const statusLabel = STATUS_LABELS[plan.athlete_status] || 'Plan registrado';
  const accessLabel = hasAccessBalance
    ? `${remaining} accesos disponibles`
    : statusLabel;
  const frequencyLabel = plan.visits_per_week
    ? `${plan.visits_per_week} veces por semana`
    : 'Frecuencia registrada';

  return (
    <div className="group relative overflow-hidden rounded-3xl bg-[#0F172A] text-white shadow-2xl shadow-slate-900/40 min-h-[280px] flex flex-col justify-between p-8 border border-white/5 transition-transform duration-500 hover:scale-[1.01]">
      
      {/* --- BACKGROUND FX --- */}
      {/* Noise Texture Overlay (Opcional, simulado con opacidad) */}
      <div className="absolute inset-0 bg-white opacity-[0.02] pointer-events-none z-0 mix-blend-overlay"></div>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 opacity-90"></div>
      
      {/* Patrón de Chip Holográfico */}
      <div className="absolute top-8 right-8 opacity-20">
         <Icon name="Cpu" size={48} strokeWidth={1} />
      </div>

      {/* --- CONTENT LAYER --- */}
      <div className="relative z-10 flex flex-col h-full justify-between">
        
        {/* HEADER: Tipo de Pase & Estado */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]"></div>
               <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em]">
                 {statusLabel}
               </span>
            </div>
            <h2 className="text-3xl font-black tracking-tighter text-white italic">
              {plan.name}
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              {plan.id ? `ID: MBr-${plan.id.toString().padStart(4, '0')}` : 'Plan sin ID visible'}
            </p>
          </div>
        </div>

        {/* BODY: Schedule & Info */}
        <div className="space-y-4">
           {/* Saldo de accesos del período (real) */}
           <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">
                 Accesos este mes
              </p>
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
                 {hasAccessBalance ? (
                   <>
                     <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white tracking-tight">{remaining}</span>
                        <span className="text-xs font-bold text-slate-400">de {allowed} disponibles</span>
                     </div>
                     <div className="mt-3 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                     </div>
                     <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-2">
                        {consumed} usados en el período
                     </p>
                   </>
                 ) : (
                   <p className="text-xs font-bold text-slate-400">{statusLabel}</p>
                 )}
              </div>
           </div>
        </div>

        {/* FOOTER: Price & Dates */}
        <div className="flex items-end justify-between pt-4 border-t border-white/10 mt-4">
           <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                 Vigencia
              </p>
              <div className="flex items-center gap-1.5 text-slate-300">
                 <Icon name="Calendar" size={12} />
                 <span className="text-xs font-bold">
                    {renewalLabel}
                 </span>
              </div>
           </div>

           <div className="text-right">
              <div className="flex items-baseline justify-end gap-1">
                 <span className="text-2xl font-black text-white tracking-tight">
                    {formatCurrency(plan.price)}
                 </span>
                 <span className="text-[10px] font-bold text-slate-400 uppercase">
                    /Mes
                 </span>
              </div>
              <p className="text-[8px] text-emerald-400 font-black uppercase tracking-widest mt-1">
                 {accessLabel}
              </p>
              <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mt-1">
                 {frequencyLabel}
              </p>
           </div>
        </div>

      </div>
    </div>
  );
};

export default MyPlanCard;
