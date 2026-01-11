import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const PlanCard = ({ plan, onEdit, onDelete, onToggleStatus, loading = false }) => {
  
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-muted/50 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-muted/50 rounded w-2/3 mb-6"></div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="h-12 bg-muted/50 rounded"></div>
          <div className="h-12 bg-muted/50 rounded"></div>
        </div>
        <div className="h-32 bg-muted/30 rounded"></div>
      </div>
    );
  }

  const occupancyRate = plan?.capacity > 0 ? Math.round((plan.enrolled / plan.capacity) * 100) : 0;
  const isNearCapacity = occupancyRate >= 80;

  return (
    <div className="bg-card border border-border rounded-xl p-6 transition-smooth hover:shadow-lg h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-heading font-semibold text-foreground">{plan.name}</h3>
            <span className={`px-2 py-1 rounded text-xs font-medium ${plan.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
              {plan.status === 'active' ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{plan.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Precio</p>
          <p className="text-lg font-bold text-foreground">€{plan.price}/mes</p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Capacidad</p>
          <p className="text-lg font-bold text-foreground">{plan.enrolled}/{plan.capacity}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Ocupación</span>
          <span className={`text-xs font-medium ${isNearCapacity ? 'text-warning' : 'text-success'}`}>{occupancyRate}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-smooth ${isNearCapacity ? 'bg-warning' : 'bg-success'}`} style={{ width: `${occupancyRate}%` }}></div>
        </div>
      </div>

      <div className="mb-4 flex-1">
        <p className="text-xs font-medium text-muted-foreground mb-2">Horarios:</p>
        <div className="flex flex-wrap gap-2">
          {plan.schedule?.length > 0 ? plan.schedule.map((sch, idx) => (
            <span key={idx} className="px-2 py-1 bg-muted/50 border border-border/50 rounded text-xs text-foreground">
              {sch.day} {sch.time}
            </span>
          )) : <span className="text-xs text-muted-foreground italic">Sin horarios definidos</span>}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Profesores:</p>
        <div className="flex flex-wrap gap-2">
          {plan.professors?.length > 0 ? plan.professors.map((prof, idx) => (
            <span key={idx} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded flex items-center gap-1">
              <Icon name="User" size={12} />
              {prof}
            </span>
          )) : <span className="text-xs text-muted-foreground italic">Sin asignar</span>}
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-border mt-auto">
        <Button variant="outline" size="sm" iconName="Edit" onClick={() => onEdit(plan)} fullWidth>
          Editar
        </Button>
        <Button variant="outline" size="sm" onClick={() => onToggleStatus(plan.id)} fullWidth>
          {plan.status === 'active' ? 'Desactivar' : 'Activar'}
        </Button>
        <Button variant="outline" size="sm" iconName="Trash2" onClick={() => onDelete(plan.id)}>
          <Icon name="Trash2" size={16} color="var(--color-error)" />
        </Button>
      </div>
    </div>
  );
};

export default PlanCard;