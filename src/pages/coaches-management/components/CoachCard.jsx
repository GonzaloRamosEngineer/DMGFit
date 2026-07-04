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
    <div className="bg-card border border-border rounded-3xl p-6 hover:shadow-xl hover:shadow-slate-200/40 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center group">

      {/* Avatar Premium */}
      <div className="relative mb-4">
        <div className="w-24 h-24 rounded-[1.5rem] flex items-center justify-center overflow-hidden border border-border shadow-sm group-hover:shadow-md transition-shadow bg-muted text-text-tertiary">
          {coach.avatar ? (
            <Image src={coach.avatar} alt={coach.name} className="w-full h-full object-cover" />
          ) : (
            <Icon name="User" size={36} />
          )}
        </div>
        {/* Indicador de estado (Punto verde) */}
        <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-[3px] border-card bg-success shadow-sm" title="Activo" />
      </div>

      {/* Info Principal */}
      <h3 className="text-xl font-black text-text-primary mb-2 line-clamp-1 w-full px-2">
        {coach.name}
      </h3>

      {coach.specialization ? (
        <span className="text-[10px] font-bold text-primary bg-info-light px-3 py-1 rounded-lg uppercase tracking-widest mb-4">
          {coach.specialization}
        </span>
      ) : (
        <span className="text-[10px] font-bold text-text-tertiary bg-muted px-3 py-1 rounded-lg uppercase tracking-widest mb-4">
          Staff General
        </span>
      )}

      <p className="text-sm font-medium text-text-secondary line-clamp-2 mb-6 w-full px-2 min-h-[40px]">
        {coach.bio || "Sin biografía disponible. El profesor aún no ha añadido una descripción."}
      </p>

      {/* Bloques de Estadísticas */}
      <div className="w-full grid grid-cols-2 gap-3 mb-6">
        <div
          className="bg-muted rounded-2xl py-3.5 flex flex-col items-center justify-center gap-1.5 cursor-help transition-colors hover:bg-muted group/mail"
          title={coach.email}
        >
          <div className="text-text-tertiary group-hover/mail:text-text-secondary transition-colors">
            <Icon name="Mail" size={18} />
          </div>
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest truncate max-w-full px-2">
            Email
          </span>
        </div>

        <button
          onClick={() => onViewAthletes(coach)}
          className="bg-muted hover:bg-info-light border border-transparent hover:border-blue-100 rounded-2xl py-3.5 flex flex-col items-center justify-center gap-1.5 group/athletes transition-all"
        >
          <div className="text-text-tertiary group-hover/athletes:text-primary transition-colors">
            <Icon name="Users" size={18} />
          </div>
          <span className="text-[10px] font-black text-text-secondary group-hover/athletes:text-primary uppercase tracking-widest">
            {coach.totalAthletes || 0} Atletas
          </span>
        </button>
      </div>

      {/* Botones de Acción */}
      <div className="flex w-full gap-2 mt-auto pt-5 border-t border-border">
        <button
          onClick={() => onEdit(coach)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-text-secondary bg-card border border-border hover:bg-muted hover:text-text-primary transition-colors"
        >
          <Icon name="Edit" size={14} /> Editar
        </button>

        {/* Botón condicional de Habilitación */}
        {coach.needsActivation && (
          <button
            onClick={() => onEnableAccount?.(coach)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-warning bg-warning-light border border-amber-100 hover:bg-warning-light transition-colors"
          >
            <Icon name="UserCheck" size={14} /> Habilitar
          </button>
        )}

        <button
          onClick={() => onDelete(coach.id)}
          className="w-10 flex flex-shrink-0 items-center justify-center rounded-xl text-text-tertiary hover:text-error hover:bg-error-light transition-colors"
          title="Eliminar Profesor"
        >
          <Icon name="Trash2" size={16} />
        </button>
      </div>

    </div>
  );
};

export default CoachCard;