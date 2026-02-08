import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import QuickActionMenu from '../../../components/ui/QuickActionMenu';

const AthleteCard = ({
  athlete,
  onSelect,
  isSelected,
  loading = false,
  canEnable = false,
  onEnableAccount, // Nueva prop para manejar la habilitación
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 animate-pulse">
        <div className="flex gap-4 items-center">
          <div className="w-12 h-12 bg-muted/50 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted/50 rounded w-1/3"></div>
            <div className="h-3 bg-muted/50 rounded w-1/4"></div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-4">
          <div className="h-8 bg-muted/50 rounded"></div>
          <div className="h-8 bg-muted/50 rounded"></div>
          <div className="h-8 bg-muted/50 rounded"></div>
          <div className="h-8 bg-muted/50 rounded"></div>
        </div>
      </div>
    );
  }

  // --- Helpers de Estilo ---
  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-success/10 text-success border-success/20';
      case 'pending': return 'bg-warning/10 text-warning border-warning/20';
      case 'overdue': return 'bg-error/10 text-error border-error/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getPaymentStatusLabel = (status) => {
    const labels = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido' };
    return labels[status] || 'Desconocido';
  };

  const renderAttendanceHeatmap = (data) => (
    <div className="flex items-center gap-1 justify-center">
      {data?.map((val, idx) => (
        <div 
          key={idx} 
          className={`w-2 h-6 rounded-sm ${val >= 80 ? 'bg-success' : val >= 50 ? 'bg-warning' : 'bg-error'}`}
          title={`Semana ${idx + 1}: ${val}%`} 
        />
      ))}
    </div>
  );

  return (
    <div className={`bg-card border rounded-lg p-4 md:p-6 transition-smooth hover:shadow-glow-primary ${isSelected ? 'border-primary shadow-glow-primary' : 'border-border'}`}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        
        {/* Info Principal */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect?.(athlete.id)}
            className="w-5 h-5 rounded border-border bg-input text-primary focus:ring-2 focus:ring-primary flex-shrink-0"
          />
          <div className="relative flex-shrink-0">
            {athlete.profileImage ? (
              <Image src={athlete.profileImage} alt={athlete.name} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="User" size={24} className="text-primary" />
              </div>
            )}
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-card ${athlete.isActive ? 'bg-success' : 'bg-muted'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-heading font-semibold text-foreground truncate">{athlete.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{athlete.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Coach: <span className="text-foreground">{athlete.coach}</span></p>
          </div>
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 flex-shrink-0 w-full lg:w-auto">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Asistencia</p>
            <span className="font-bold text-foreground">{athlete.attendanceRate}%</span>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Rendimiento</p>
            <span className="font-bold text-foreground">{athlete.performanceScore}</span>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Estado Pago</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getPaymentStatusColor(athlete.paymentStatus)}`}>
              {getPaymentStatusLabel(athlete.paymentStatus)}
            </span>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Últ. Mes</p>
            {renderAttendanceHeatmap(athlete.attendanceLast30Days)}
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0 justify-end w-full lg:w-auto mt-2 lg:mt-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate(`/individual-athlete-profile/${athlete.id}`)}
            iconName="Eye"
          >
            Perfil
          </Button>

          {/* AJUSTE: Botón Habilitar Condicional */}
          {athlete.needsActivation && canEnable && (
            <Button
              variant="default"
              size="sm"
              iconName="UserCheck"
              onClick={() => onEnableAccount?.(athlete)}
            >
              Habilitar
            </Button>
          )}

          <QuickActionMenu 
            entityId={athlete.id} 
            entityType="athlete" 
            availableActions={[
              { id: 'msg', label: 'Mensaje', icon: 'MessageSquare' }
            ]} 
          />
        </div>
      </div>
    </div>
  );
};

export default AthleteCard;
