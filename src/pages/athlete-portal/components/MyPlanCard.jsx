import React, { useMemo } from 'react';
import Icon from '../../../components/AppIcon';

// --- UTILS & CONFIG ---

const DAYS_OF_WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// Simula la detección de días activos basado en el plan
// Asumimos que plan.schedule podría ser ["Lunes", "Miércoles"] o ids [1, 3]
const getActiveDays = (schedule = []) => {
  // Lógica simple: si el schedule tiene longitud, asumimos una distribución
  // En un caso real, haríamos match exacto con los días.
  // Aquí simulamos para el ejemplo visual si no hay datos exactos.
  const frequency = schedule.length || 3; 
  // Patrón ejemplo: L-X-V (Indices 0, 2, 4)
  if (frequency === 1) return [0]; // L
  if (frequency === 2) return [0, 2]; // L, X
  if (frequency === 3) return [0, 2, 4]; // L, X, V
  if (frequency === 4) return [0, 1, 3, 4]; // L, M, J, V
  if (frequency >= 5) return [0, 1, 2, 3, 4]; // L-V
  return [];
};

// Formateador de moneda
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0
  }).format(amount);
};

// --- SUB-COMPONENTS ---

const ScheduleVisualizer = ({ activeIndices }) => (
  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
    {DAYS_OF_WEEK.map((day, index) => {
      const isActive = activeIndices.includes(index);
      return (
        <div key={day} className="flex flex-col items-center gap-1.5">
          <span className={`text-[9px] font-bold ${isActive ? 'text-white' : 'text-slate-500'}`}>
            {day}
          </span>
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            isActive 
              ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)] scale-110' 
              : 'bg-slate-700'
          }`} />
        </div>
      );
    })}
  </div>
);

// --- MAIN COMPONENT ---

const MyPlanCard = ({ plan }) => {
  // Empty State Premium
  if (!plan) {
    return (
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 min-h-[240px] flex flex-col items-center justify-center text-center border border-slate-800">
        <Icon name="CreditCard" size={32} className="text-slate-600 mb-3 opacity-50" />
        <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs">Sin Plan Activo</h3>
        <button className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors">
          Explorar Planes
        </button>
      </div>
    );
  }

  // Pre-calcular datos visuales
  const activeDays = useMemo(() => getActiveDays(plan.schedule), [plan.schedule]);
  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + 15); // Simulación: renueva en 15 días

  return (
    <div className="group relative overflow-hidden rounded-[2.5rem] bg-[#0F172A] text-white shadow-2xl shadow-slate-900/40 min-h-[280px] flex flex-col justify-between p-8 border border-white/5 transition-transform duration-500 hover:scale-[1.01]">
      
      {/* --- BACKGROUND FX --- */}
      {/* Noise Texture Overlay (Opcional, simulado con opacidad) */}
      <div className="absolute inset-0 bg-white opacity-[0.02] pointer-events-none z-0 mix-blend-overlay"></div>
      
      {/* Gradientes Dinámicos */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-20 group-hover:opacity-30 transition-opacity duration-700"></div>
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-60 h-60 bg-purple-600 rounded-full blur-[100px] opacity-20 group-hover:opacity-25 transition-opacity duration-700"></div>
      
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
                 Membresía Activa
               </span>
            </div>
            <h2 className="text-3xl font-black tracking-tighter text-white italic">
              {plan.name}
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              ID: {plan.id ? `MBr-${plan.id.toString().padStart(4, '0')}` : 'MBr-8821'}
            </p>
          </div>
        </div>

        {/* BODY: Schedule & Info */}
        <div className="space-y-4">
           {/* Visualizador de Días */}
           <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">
                 Cronograma Semanal
              </p>
              <ScheduleVisualizer activeIndices={activeDays} />
           </div>
        </div>

        {/* FOOTER: Price & Dates */}
        <div className="flex items-end justify-between pt-4 border-t border-white/10 mt-4">
           <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                 Renovación
              </p>
              <div className="flex items-center gap-1.5 text-slate-300">
                 <Icon name="Calendar" size={12} />
                 <span className="text-xs font-bold">
                    {renewalDate.toLocaleDateString('es-UY', { month: 'short', day: 'numeric' })}
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
                 Pago al día
              </p>
           </div>
        </div>

      </div>
    </div>
  );
};

export default MyPlanCard;