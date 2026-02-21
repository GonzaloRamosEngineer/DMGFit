import React from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const CoachCard = ({ 
  coach, 
  onDelete, 
  onEdit, 
  onViewAthletes, 
  onEnableAccount
}) => {
  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 hover:shadow-xl hover:shadow-slate-200/40 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center group">
      
      {/* Avatar Premium */}
      <div className="relative mb-4">
        <div className="w-24 h-24 rounded-[1.5rem] flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm group-hover:shadow-md transition-shadow bg-slate-50 text-slate-300">
          {coach.avatar ? (
            <Image src={coach.avatar} alt={coach.name} className="w-full h-full object-cover" />
          ) : (
            <Icon name="User" size={36} />
          )}
        </div>
        {/* Indicador de estado (Punto verde) */}
        <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-[3px] border-white bg-emerald-500 shadow-sm" title="Activo" />
      </div>
      
      {/* Info Principal */}
      <h3 className="text-xl font-black text-slate-800 mb-2 line-clamp-1 w-full px-2">
        {coach.name}
      </h3>
      
      {coach.specialization ? (
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg uppercase tracking-widest mb-4">
          {coach.specialization}
        </span>
      ) : (
        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg uppercase tracking-widest mb-4">
          Staff General
        </span>
      )}
      
      <p className="text-sm font-medium text-slate-500 line-clamp-2 mb-6 w-full px-2 min-h-[40px]">
        {coach.bio || "Sin biografía disponible. El profesor aún no ha añadido una descripción."}
      </p>

      {/* Bloques de Estadísticas */}
      <div className="w-full grid grid-cols-2 gap-3 mb-6">
        <div 
          className="bg-slate-50 rounded-2xl py-3.5 flex flex-col items-center justify-center gap-1.5 cursor-help transition-colors hover:bg-slate-100 group/mail"
          title={coach.email}
        >
          <div className="text-slate-400 group-hover/mail:text-slate-600 transition-colors">
            <Icon name="Mail" size={18} />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-full px-2">
            Email
          </span>
        </div>
        
        <button 
          onClick={() => onViewAthletes(coach)}
          className="bg-slate-50 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-2xl py-3.5 flex flex-col items-center justify-center gap-1.5 group/athletes transition-all"
        >
          <div className="text-slate-400 group-hover/athletes:text-blue-500 transition-colors">
            <Icon name="Users" size={18} />
          </div>
          <span className="text-[10px] font-black text-slate-700 group-hover/athletes:text-blue-700 uppercase tracking-widest">
            {coach.totalAthletes || 0} Atletas
          </span>
        </button>
      </div>

      {/* Botones de Acción */}
      <div className="flex w-full gap-2 mt-auto pt-5 border-t border-slate-100">
        <button 
          onClick={() => onEdit(coach)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-colors"
        >
          <Icon name="Edit" size={14} /> Editar
        </button>

        {/* Botón condicional de Habilitación */}
        {coach.needsActivation && (
          <button
            onClick={() => onEnableAccount?.(coach)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors"
          >
            <Icon name="UserCheck" size={14} /> Habilitar
          </button>
        )}

        <button 
          onClick={() => onDelete(coach.id)} 
          className="w-10 flex flex-shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          title="Eliminar Profesor"
        >
          <Icon name="Trash2" size={16} />
        </button>
      </div>

    </div>
  );
};

export default CoachCard;