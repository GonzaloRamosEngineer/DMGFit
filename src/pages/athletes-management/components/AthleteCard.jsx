import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import QuickActionMenu from '../../../components/ui/QuickActionMenu';

const AthleteCard = ({ athlete, onSelect, isSelected }) => {
  const navigate = useNavigate();

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-success/10 text-success border-success/20';
      case 'pending':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'overdue':
        return 'bg-error/10 text-error border-error/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getPaymentStatusLabel = (status) => {
    switch (status) {
      case 'paid':
        return 'Pagado';
      case 'pending':
        return 'Pendiente';
      case 'overdue':
        return 'Vencido';
      default:
        return 'Desconocido';
    }
  };

  const getPerformanceTrendIcon = (trend) => {
    if (trend > 0) return 'TrendingUp';
    if (trend < 0) return 'TrendingDown';
    return 'Minus';
  };

  const getPerformanceTrendColor = (trend) => {
    if (trend > 0) return 'var(--color-success)';
    if (trend < 0) return 'var(--color-error)';
    return 'var(--color-muted-foreground)';
  };

  const renderAttendanceHeatmap = (attendanceData) => {
    return (
      <div className="flex items-center gap-1">
        {attendanceData?.map((value, index) => (
          <div
            key={index}
            className={`w-2 h-6 md:w-3 md:h-8 rounded-sm ${
              value >= 90
                ? 'bg-success'
                : value >= 70
                ? 'bg-warning'
                : value >= 50
                ? 'bg-accent' :'bg-error'
            }`}
            title={`Semana ${index + 1}: ${value}%`}
          />
        ))}
      </div>
    );
  };

  const handleViewProfile = () => {
    navigate(`/individual-athlete-profile/${athlete?.id}`);
  };

  return (
    <div
      className={`bg-card border rounded-lg p-4 md:p-6 transition-smooth hover:shadow-glow-primary ${
        isSelected ? 'border-primary shadow-glow-primary' : 'border-border'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(athlete?.id)}
            className="w-5 h-5 rounded border-border bg-input text-primary focus:ring-2 focus:ring-primary flex-shrink-0"
            aria-label={`Seleccionar ${athlete?.name}`}
          />
          
          <div className="relative flex-shrink-0">
            <Image
              src={athlete?.profileImage}
              alt={athlete?.profileImageAlt}
              className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover"
            />
            <div
              className={`absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-card ${
                athlete?.isActive ? 'bg-success' : 'bg-muted'
              }`}
              title={athlete?.isActive ? 'Activo' : 'Inactivo'}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base md:text-lg font-heading font-semibold text-foreground truncate">
              {athlete?.name}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{athlete?.email}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Entrenador: <span className="text-foreground">{athlete?.coach}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 flex-shrink-0">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Asistencia</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-base md:text-lg font-heading font-bold text-foreground">
                {athlete?.attendanceRate}%
              </span>
              <Icon
                name={athlete?.attendanceRate >= 80 ? 'CheckCircle' : 'AlertCircle'}
                size={16}
                color={athlete?.attendanceRate >= 80 ? 'var(--color-success)' : 'var(--color-warning)'}
              />
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Rendimiento</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-base md:text-lg font-heading font-bold text-foreground">
                {athlete?.performanceScore}%
              </span>
              <Icon
                name={getPerformanceTrendIcon(athlete?.performanceTrend)}
                size={16}
                color={getPerformanceTrendColor(athlete?.performanceTrend)}
              />
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Estado de Pago</p>
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPaymentStatusColor(
                athlete?.paymentStatus
              )}`}
            >
              {getPaymentStatusLabel(athlete?.paymentStatus)}
            </span>
          </div>

          <div className="text-center col-span-2 lg:col-span-1">
            <p className="text-xs text-muted-foreground mb-2">Últimas 4 Semanas</p>
            {renderAttendanceHeatmap(athlete?.attendanceLast30Days)}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 justify-end lg:justify-start">
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewProfile}
            iconName="Eye"
            iconPosition="left"
          >
            Ver Perfil
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            iconName="MessageSquare"
            iconPosition="left"
          >
            Mensaje
          </Button>

          <QuickActionMenu
            entityId={athlete?.id}
            entityType="athlete"
            availableActions={[
              { id: 'schedule', label: 'Programar Sesión', icon: 'Calendar', action: 'schedule' },
              { id: 'message', label: 'Enviar Mensaje', icon: 'MessageSquare', action: 'message' },
              { id: 'payment', label: 'Recordatorio de Pago', icon: 'Bell', action: 'payment' },
              { id: 'profile', label: 'Ver Perfil Completo', icon: 'User', action: 'profile' }
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export default AthleteCard;