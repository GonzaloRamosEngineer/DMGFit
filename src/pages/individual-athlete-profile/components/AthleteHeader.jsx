import React from 'react';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import QuickActionMenu from '../../../components/ui/QuickActionMenu';

const AthleteHeader = ({ athlete, onScheduleSession, onSendMessage, onPaymentReminder, onExport, loading = false }) => {
  const quickActions = [
    { id: 'schedule', label: 'Programar Sesión', icon: 'Calendar', action: 'schedule' },
    { id: 'message', label: 'Enviar Mensaje', icon: 'MessageSquare', action: 'message' },
    { id: 'payment', label: 'Recordatorio de Pago', icon: 'Bell', action: 'payment' },
    { id: 'export', label: 'Exportar Informe PDF', icon: 'Download', action: 'export' }
  ];

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 mb-6 animate-pulse flex flex-col lg:flex-row gap-6">
        <div className="w-24 h-24 bg-muted/50 rounded-full flex-shrink-0"></div>
        <div className="flex-1 space-y-3">
          <div className="h-8 bg-muted/50 rounded w-1/2"></div>
          <div className="h-4 bg-muted/50 rounded w-1/3"></div>
          <div className="flex gap-4 mt-4">
            <div className="h-4 bg-muted/50 rounded w-20"></div>
            <div className="h-4 bg-muted/50 rounded w-20"></div>
          </div>
        </div>
      </div>
    );
  }

  // Protección si athlete es null aunque loading sea false
  if (!athlete) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 lg:p-8 mb-4 md:mb-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 md:gap-6">
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden border-4 border-primary/20 bg-background flex items-center justify-center">
            {athlete.photo || athlete.profileImage ? (
              <Image
                src={athlete.photo || athlete.profileImage}
                alt={athlete.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Icon name="User" size={48} className="text-primary/50" />
            )}
          </div>
          <div className={`absolute bottom-0 right-0 w-6 h-6 md:w-7 md:h-7 rounded-full border-4 border-card ${
            athlete.status === 'active' ? 'bg-success' : 'bg-muted'
          }`} title={athlete.status === 'active' ? 'Activo' : 'Inactivo'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-semibold text-foreground truncate">
              {athlete.name}
            </h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
              athlete.membershipType === 'premium' ? 'bg-secondary/20 text-secondary' : 'bg-muted text-muted-foreground'
            }`}>
              <Icon 
                name={athlete.membershipType === 'premium' ? 'Crown' : 'User'} 
                size={14} 
                className="mr-1.5"
              />
              {athlete.membershipType === 'premium' ? 'Premium' : 'Estándar'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 text-sm md:text-base">
            <div className="flex items-center text-muted-foreground">
              <Icon name="Hash" size={16} className="mr-2 flex-shrink-0" color="var(--color-primary)" />
              <span className="truncate">ID: {athlete.id?.slice(0, 8)}</span>
            </div>
            <div className="flex items-center text-muted-foreground">
              <Icon name="Mail" size={16} className="mr-2 flex-shrink-0" color="var(--color-primary)" />
              <span className="truncate">{athlete.email}</span>
            </div>
            {athlete.phone && (
              <div className="flex items-center text-muted-foreground">
                <Icon name="Phone" size={16} className="mr-2 flex-shrink-0" color="var(--color-primary)" />
                <span className="truncate">{athlete.phone}</span>
              </div>
            )}
            <div className="flex items-center text-muted-foreground">
              <Icon name="Calendar" size={16} className="mr-2 flex-shrink-0" color="var(--color-primary)" />
              <span className="truncate">Desde: {new Date(athlete.join_date || athlete.joinDate).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto mt-4 lg:mt-0">
          <Button
            variant="default"
            size="default"
            iconName="Calendar"
            iconPosition="left"
            onClick={onScheduleSession}
            className="flex-1 lg:flex-initial"
          >
            <span className="hidden sm:inline">Programar</span>
            <span className="sm:hidden">Sesión</span>
          </Button>
          <Button
            variant="outline"
            size="default"
            iconName="MessageSquare"
            iconPosition="left"
            onClick={onSendMessage}
            className="flex-1 lg:flex-initial"
          >
            <span className="hidden sm:inline">Mensaje</span>
            <span className="sm:hidden">Chat</span>
          </Button>
          <QuickActionMenu
            entityId={athlete.id}
            entityType="athlete"
            availableActions={quickActions}
          />
        </div>
      </div>
    </div>
  );
};

export default AthleteHeader;