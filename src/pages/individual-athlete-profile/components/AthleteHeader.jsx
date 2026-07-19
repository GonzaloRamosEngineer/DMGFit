// C:\Projects\DMG Fitness\src\pages\individual-athlete-profile\components\AthleteHeader.jsx
import React, { useState } from 'react';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { formatearFecha } from '../../../utils/formatters';
import { useConfirm } from '../../../components/ui/ConfirmProvider';
import { useToast } from '../../../hooks/useToast';
import { deactivateAthlete } from '../../../services/athletes';

const INTERNAL_DOMAINS = ["@dmg.internal", "@vcfit.internal"];

const formatCurrency = (amount) => {
  const value = Number(amount || 0);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(value);
};

const AthleteHeader = ({
  athlete,
  onScheduleSession,
  onExport,
  loading = false,
  onEnableAccess,
  canEnable = false,
  canManage = false,
  onEditData,
}) => {
  const [processingStatus, setProcessingStatus] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const confirm = useConfirm();
  const { toast } = useToast();

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

  const handleToggleAthleteStatus = async () => {
    const isActive = athlete.status === 'active';

    if (isActive) {
      const ok1 = await confirm({
        title: 'Desactivar atleta',
        message: `¿Deseas desactivar a ${athlete.name}?`,
        confirmLabel: 'Continuar',
        variant: 'danger',
      });
      if (!ok1) return;

      const ok2 = await confirm({
        title: 'Confirmar desactivación',
        message:
          'El atleta quedará sin acceso operativo, se cerrarán sus asignaciones semanales activas y se conservará todo el historial (pagos, asistencias, notas y accesos).',
        confirmLabel: 'Desactivar',
        variant: 'danger',
      });
      if (!ok2) return;
    }

    setProcessingStatus(true);
    try {
      if (isActive) {
        await deactivateAthlete(athlete.id);
        toast.success('Atleta desactivado correctamente.');
      } else {
        toast('Este atleta ya está inactivo.');
      }
      window.location.reload();
    } catch (error) {
      console.error('Error actualizando estado del atleta:', error);
      toast.error('No se pudo actualizar el estado: ' + (error.message || 'Error desconocido'));
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
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card ${
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

            {/* Chips de resumen (válido que estén acá; el detalle vive abajo en Membresía) */}
            <div className="flex flex-wrap gap-2">
              {athlete.planOption && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                  <Icon name="Tag" size={12} />
                  {athlete.planOption}
                </span>
              )}

              {hasVisitsPerWeek && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-info-light text-info text-xs font-bold">
                  <Icon name="Repeat" size={12} />
                  {athlete.visits_per_week}x / semana
                </span>
              )}

              {hasTierPrice && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-success-light text-success text-xs font-bold">
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
                className="bg-warning hover:bg-warning/90 text-warning-foreground border-none shadow-sm"
              >
                Habilitar Acceso
              </Button>
            )}

            {canManage && onScheduleSession && (
              <Button
                variant="outline"
                size="sm"
                iconName="Calendar"
                onClick={onScheduleSession}
                title="Asignar o modificar los turnos semanales del atleta"
              >
                Turnos
              </Button>
            )}

            {canManage && onExport && (
              <Button
                variant="outline"
                size="sm"
                iconName="Download"
                onClick={() => onExport(athlete)}
                title="Descargar informe del atleta en PDF"
              >
                Exportar PDF
              </Button>
            )}

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title={showDetails ? 'Ocultar detalles' : 'Ver detalles'}
            >
              <Icon
                name={showDetails ? 'ChevronUp' : 'ChevronDown'}
                size={20}
                className="text-muted-foreground"
              />
            </button>
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="border-t border-border bg-muted/20 p-4 animate-in slide-in-from-top duration-200">
          {/* ✅ Detalles solo de identidad (sin repetir membresía) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
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
                    ? formatearFecha(athlete.join_date || athlete.joinDate)
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          {canManage && (
            <div className="flex items-center justify-end gap-2">
              {onEditData && (
                <Button
                  variant="outline"
                  size="sm"
                  iconName="Edit"
                  onClick={() => onEditData(athlete)}
                >
                  Editar Datos
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                iconName="UserX"
                onClick={handleToggleAthleteStatus}
                loading={processingStatus}
                className="border-warning/40 text-warning hover:bg-warning-light"
              >
                {athlete.status === 'active' ? 'Desactivar Atleta' : 'Atleta Inactivo'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AthleteHeader;