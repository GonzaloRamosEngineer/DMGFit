import React from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';

// Recibimos nuevas props: onEdit y onViewAthletes
const CoachCard = ({ coach, onDelete, onEdit, onViewAthletes }) => {
  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-smooth flex flex-col items-center text-center group">
      <div className="relative">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4 overflow-hidden border-2 border-transparent group-hover:border-primary transition-all">
          {coach.avatar ? (
            <Image src={coach.avatar} alt={coach.name} className="w-full h-full object-cover" />
          ) : (
            <Icon name="User" size={32} color="var(--color-primary)" />
          )}
        </div>
      </div>
      
      <h3 className="text-lg font-bold text-foreground mb-1">{coach.name}</h3>
      <p className="text-sm text-primary font-medium mb-3">{coach.specialization}</p>
      
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1 h-10">
        {coach.bio || "Sin biografía disponible."}
      </p>

      {/* Estadísticas Clickables */}
      <div className="w-full grid grid-cols-2 gap-2 mb-4 text-xs text-muted-foreground border-y border-border py-3">
        <div className="flex flex-col items-center" title={coach.email}>
          <Icon name="Mail" size={14} className="mb-1" />
          <span className="truncate max-w-full w-20">Email</span>
        </div>
        <button 
          onClick={() => onViewAthletes(coach)}
          className="flex flex-col items-center border-l border-border hover:text-primary transition-colors cursor-pointer"
        >
          <Icon name="Users" size={14} className="mb-1" />
          <span className="font-bold">{coach.totalAthletes || 0} Atletas</span>
        </button>
      </div>

      <div className="flex gap-2 w-full">
        <Button variant="outline" size="sm" fullWidth iconName="Edit" onClick={() => onEdit(coach)}>
          Editar
        </Button>
        <Button variant="ghost" size="sm" iconName="Trash2" onClick={() => onDelete(coach.id)} className="text-error hover:bg-error/10 hover:text-error" />
      </div>
    </div>
  );
};

export default CoachCard;