import React from 'react';
import Icon from '../../../components/AppIcon';

const PlanCard = ({ plan, onEdit, onDelete, onToggleStatus, loading = false }) => {
  
  if (loading) {
    return (
      <div className="bg-white border border-slate-100 rounded-3xl p-6 animate-pulse flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
          <div className="h-6 bg-slate-100 rounded w-1/2"></div>
          <div className="h-6 bg-slate-100 rounded-full w-16"></div>
        </div>
        <div className="h-4 bg-slate-100 rounded w-full mb-2"></div>
        <div className="h-4 bg-slate-100 rounded w-2/3 mb-6"></div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="h-16 bg-slate-50 rounded-2xl"></div>
          <div className="h-16 bg-slate-50 rounded-2xl"></div>
        </div>
        
        <div className="h-3 bg-slate-100 rounded-full w-full mb-6"></div>
        
        <div className="space-y-4 mb-6 flex-1">
          <div className="h-10 bg-slate-50 rounded-xl w-full"></div>
          <div className="h-10 bg-slate-50 rounded-xl w-3/4"></div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-50">
          <div className="h-10 bg-slate-100 rounded-xl"></div>
          <div className="h-10 bg-slate-100 rounded-xl"></div>
          <div className="h-10 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const occupancyRate = plan?.capacity > 0 ? Math.round((plan.enrolled / plan.capacity) * 100) : 0;
  const isNearCapacity = occupancyRate >= 80;
  const isFull = occupancyRate >= 100;

  // Determinar el color de la barra de progreso
  const getProgressBarColor = () => {
    if (isFull) return 'bg-rose-500';
    if (isNearCapacity) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  const getOccupancyTextColor = () => {
    if (isFull) return 'text-rose-600';
    if (isNearCapacity) return 'text-amber-600';
    return 'text-emerald-600';
  };

  return (
    <div className={`bg-white border rounded-3xl p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex flex-col h-full ${plan.status === 'active' ? 'border-slate-100' : 'border-slate-200 bg-slate-50/50'}`}>
      
      {/* Cabecera: Título y Estado */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <h3 className={`text-xl font-black line-clamp-1 ${plan.status === 'active' ? 'text-slate-800' : 'text-slate-500'}`}>
          {plan.name}
        </h3>
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border flex-shrink-0 ${
          plan.status === 'active' 
            ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
            : 'bg-slate-100 text-slate-500 border-slate-200'
        }`}>
          {plan.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      </div>
      
      <p className="text-sm font-medium text-slate-500 line-clamp-2 mb-6 min-h-[40px]">
        {plan.description}
      </p>

      {/* Grid de Precio y Capacidad */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Precio</p>
          <div className="flex items-end gap-0.5">
            <p className={`text-xl font-black ${plan.status === 'active' ? 'text-slate-800' : 'text-slate-500'}`}>${plan.price}</p>
            <span className="text-xs font-bold text-slate-400 mb-1">/mes</span>
          </div>
        </div>
        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Inscritos</p>
          <div className="flex items-end gap-1">
            <p className={`text-xl font-black ${plan.status === 'active' ? 'text-slate-800' : 'text-slate-500'}`}>
              {plan.enrolled}
            </p>
            <span className="text-sm font-bold text-slate-400 mb-0.5">/ {plan.capacity}</span>
          </div>
        </div>
      </div>

      {/* Barra de Ocupación */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ocupación</span>
          <span className={`text-[10px] font-black uppercase tracking-widest ${getOccupancyTextColor()}`}>
            {occupancyRate}% {isFull ? '(Lleno)' : ''}
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ease-out ${getProgressBarColor()}`} 
            style={{ width: `${Math.min(occupancyRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Horarios y Profesores */}
      <div className="space-y-4 mb-6 flex-1">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Icon name="Clock" size={12} /> Horarios
          </p>
          <div className="flex flex-wrap gap-1.5">
            {plan.schedule?.length > 0 ? plan.schedule.map((sch, idx) => (
              <span key={idx} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600">
                {sch.day} <span className="text-slate-400 font-medium">|</span> {sch.time}
                {Number.isFinite(sch.capacity) && (
                  <span className="text-[10px] text-slate-500 font-semibold ml-1">({sch.remaining ?? '—'}/{sch.capacity})</span>
                )}
              </span>
            )) : <span className="text-[11px] font-medium text-slate-400 italic">Sin horarios definidos</span>}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Icon name="Users" size={12} /> Profesores
          </p>
          <div className="flex flex-wrap gap-1.5">
            {plan.professors?.length > 0 ? plan.professors.map((prof, idx) => (
              <span key={idx} className="px-2 py-1 bg-violet-50 border border-violet-100 text-violet-600 text-[11px] font-bold rounded-lg flex items-center gap-1">
                <Icon name="User" size={10} />
                {prof}
              </span>
            )) : <span className="text-[11px] font-medium text-slate-400 italic">Sin asignar</span>}
          </div>
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="flex gap-2 pt-4 border-t border-slate-100 mt-auto">
        <button 
          onClick={() => onEdit(plan)} 
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          <Icon name="Edit" size={14} /> Editar
        </button>
        
        <button 
          onClick={() => onToggleStatus(plan.id)} 
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors border ${
            plan.status === 'active' 
              ? 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50' 
              : 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100'
          }`}
        >
          <Icon name={plan.status === 'active' ? "EyeOff" : "Eye"} size={14} /> 
          {plan.status === 'active' ? 'Ocultar' : 'Activar'}
        </button>
        
        <button 
          onClick={() => onDelete(plan.id)} 
          className="w-10 flex flex-shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          title="Eliminar Plan"
        >
          <Icon name="Trash2" size={16} />
        </button>
      </div>

    </div>
  );
};

export default PlanCard;