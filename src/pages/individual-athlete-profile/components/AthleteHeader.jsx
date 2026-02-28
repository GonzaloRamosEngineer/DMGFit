import React, { useState } from 'react';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import QuickActionMenu from '../../../components/ui/QuickActionMenu';
import { deactivateAthlete } from '../../../services/athletes';

const INTERNAL_DOMAINS = ["@dmg.internal", "@vcfit.internal"];

const formatCurrency = (amount) => {
  const value = Number(amount || 0);
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
  }).format(value);
};

const AthleteHeader = ({
  athlete,
  onScheduleSession,
  onSendMessage,
  onPaymentReminder,
  onExport,
  loading = false,
  onEnableAccess,
  canEnable = false,
}) => {
  const [processingStatus, setProcessingStatus] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const isOffline =
    athlete?.email && INTERNAL_DOMAINS.some((domain) => athlete.email.endsWith(domain));

  const membershipType = athlete?.membership_type || athlete?.membershipType || 'standard';
  const isPremium = String(membershipType).toLowerCase() === 'premium';

  const hasVisitsPerWeek =
    athlete?.visits_per_week !== null &&
    athlete?.visits_per_week !== undefined &&
    athlete?.visits_per_week !== '';

  const hasTierPrice =
    athlete?.plan_tier_price !== null &&
    athlete?.plan_tier_price !== undefined &&
    athlete?.plan_tier_price !== '';

  const quickActions = [
    { id: 'schedule', label: 'Programar Sesión', icon: 'Calendar', action: 'schedule' },
    { id: 'message', label: 'Enviar Mensaje', icon: 'MessageSquare', action: 'message' },
    { id: 'payment', label: 'Recordatorio de Pago', icon: 'Bell', action: 'payment' },
    { id: 'export', label: 'Exportar Informe PDF', icon: 'Download', action: 'export' }
  ];

  const handleToggleAthleteStatus = async () => {
    const isActive = athlete.status === 'active';

    if (isActive) {
      const confirmFirst = window.confirm(`¿Deseas desactivar a ${athlete.name}?`);
      if (!confirmFirst) return;

      const confirmSecond = window.confirm(
        'El atleta quedará sin acceso operativo, se cerrarán sus asignaciones semanales activas y se conservará todo el historial (pagos, asistencias, notas y accesos).'
      );
      if (!confirmSecond) return;
    }

    setProcessingStatus(true);
    try {
      if (isActive) {
        await deactivateAthlete(athlete.id);
        alert('Atleta desactivado correctamente.');
      } else {
        alert('Este atleta ya está inactivo.');
      }
      window.location.reload();
    } catch (error) {
      console.error('Error actualizando estado del atleta:', error);
      alert('No se pudo actualizar el estado: ' + (error.message || 'Error desconocido'));
    } finally {
      setProcessingStatus(false);
    }
  };

  const handleEnableAccess = () => {
    onEnableAccess?.(athlete);
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 mb-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-muted/50 rounded-xl"></div>
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-muted/50 rounded w-1/3"></div>
            <div className="h-4 bg-muted/50 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!athlete) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-4 shadow-sm">
      <div className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-primary/10 bg-muted/20">
              {athlete.photo || athlete.profileImage ? (
                <Image
                  src={athlete.photo || athlete.profileImage}
                  alt={athlete.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon name="User" size={24} className="text-muted-foreground/40" />
                </div>
              )}
            </div>
            <div
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                athlete.status === 'active' ? 'bg-success' : 'bg-muted'
              }`}
            ></div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-heading font-bold text-foreground truncate">
                {athlete.name}
              </h1>

              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold uppercase ${
                    isPremium
                      ? 'bg-secondary/10 text-secondary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon name={isPremium ? 'Crown' : 'Shield'} size={12} />
                  {isPremium ? 'Premium' : 'Estándar'}
                </span>

                {isOffline && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold uppercase bg-warning/10 text-warning">
                    <Icon name="CloudOff" size={12} />
                    Offline
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-2">
              <div className={`flex items-center gap-1 ${athlete.status === 'active' ? '' : 'opacity-50'}`}>
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    athlete.status === 'active' ? 'bg-success' : 'bg-muted'
                  }`}
                ></div>
                <span className="capitalize">
                  {athlete.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              {athlete.planName && (
                <div className="flex items-center gap-1">
                  <Icon name="CreditCard" size={14} />
                  <span className="font-medium">{athlete.planName}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {athlete.planOption && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                  <Icon name="Tag" size={12} />
                  {athlete.planOption}
                </span>
              )}

              {hasVisitsPerWeek && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-700 text-xs font-bold">
                  <Icon name="Repeat" size={12} />
                  {athlete.visits_per_week}x / semana
                </span>
              )}

              {hasTierPrice && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 text-xs font-bold">
                  <Icon name="Wallet" size={12} />
                  {formatCurrency(athlete.plan_tier_price)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isOffline && canEnable && (
              <Button
                variant="default"
                size="sm"
                iconName="Smartphone"
                onClick={handleEnableAccess}
                className="bg-amber-500 hover:bg-amber-600 text-white border-none shadow-sm"
              >
                Habilitar Acceso
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              iconName="Calendar"
              onClick={onScheduleSession}
            >
              Agendar
            </Button>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Icon
                name={showDetails ? 'ChevronUp' : 'ChevronDown'}
                size={20}
                className="text-muted-foreground"
              />
            </button>

            <QuickActionMenu
              entityId={athlete.id}
              entityType="athlete"
              availableActions={quickActions}
            />
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="border-t border-border bg-muted/20 p-4 animate-in slide-in-from-top duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Icon name="Fingerprint" size={16} className="text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase font-medium">Documento</p>
                <p className="text-sm font-bold text-foreground truncate">{athlete.dni || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Icon
                name={isOffline ? 'MailX' : 'Mail'}
                size={16}
                className={isOffline ? 'text-warning' : 'text-primary'}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase font-medium">Email</p>
                <p
                  className={`text-sm font-bold truncate ${
                    isOffline ? 'text-warning italic' : 'text-foreground'
                  }`}
                >
                  {athlete.email || '—'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Icon name="Calendar" size={16} className="text-accent" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase font-medium">Miembro desde</p>
                <p className="text-sm font-bold text-foreground">
                  {athlete.join_date || athlete.joinDate
                    ? new Date(athlete.join_date || athlete.joinDate).toLocaleDateString('es-ES')
                    : '—'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Icon name="CreditCard" size={16} className="text-secondary" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase font-medium">Plan / Variante</p>
                <p className="text-sm font-bold text-foreground truncate">
                  {athlete.planName || 'Sin Plan'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {athlete.planOption || '—'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Icon name="Wallet" size={16} className="text-emerald-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase font-medium">Frecuencia / Precio</p>
                <p className="text-sm font-bold text-foreground truncate">
                  {hasVisitsPerWeek ? `${athlete.visits_per_week}x / semana` : '—'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {hasTierPrice ? formatCurrency(athlete.plan_tier_price) : 'Sin precio acordado'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Icon name="CreditCard" size={16} className="text-secondary" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase font-medium">Plan / Variante</p>
                <p className="text-sm font-bold text-foreground truncate">{athlete.planName || 'Sin Plan'}</p>
                <p className="text-xs text-muted-foreground truncate">{athlete.planOption || '—'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              iconName="UserX"
              onClick={handleToggleAthleteStatus}
              loading={processingStatus}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              {athlete.status === 'active' ? 'Desactivar Atleta' : 'Atleta Inactivo'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AthleteHeader;