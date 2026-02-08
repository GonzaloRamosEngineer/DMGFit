import React, { useState } from 'react';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import QuickActionMenu from '../../../components/ui/QuickActionMenu';

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
  const [deleting, setDeleting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Mantenemos la detección de dominio corregida para que el botón sea visible
  const isOffline = athlete?.email?.includes('@vcfit.internal') || athlete?.email?.includes('@dmg.internal');

  const quickActions = [
    { id: 'schedule', label: 'Programar Sesión', icon: 'Calendar', action: 'schedule' },
    { id: 'message', label: 'Enviar Mensaje', icon: 'MessageSquare', action: 'message' },
    { id: 'payment', label: 'Recordatorio de Pago', icon: 'Bell', action: 'payment' },
    { id: 'export', label: 'Exportar Informe PDF', icon: 'Download', action: 'export' }
  ];

  const handleDeleteAthlete = async () => {
    const confirmFirst = window.confirm(`¿Estás COMPLETAMENTE seguro de eliminar a ${athlete.name}?`);
    if (!confirmFirst) return;

    const confirmSecond = window.confirm("Esta acción eliminará permanentemente todos sus pagos, asistencias, resultados de entrenamientos y el perfil de usuario. No se puede deshacer. ¿Continuar?");
    if (!confirmSecond) return;

    setDeleting(true);
    try {
      const athleteId = athlete.id;
      const profileId = athlete.profile_id || athlete.profileId;

      await supabase.from('access_logs').delete().eq('athlete_id', athleteId);
      await supabase.from('attendance').delete().eq('athlete_id', athleteId);
      await supabase.from('payments').delete().eq('athlete_id', athleteId);
      await supabase.from('performance_metrics').delete().eq('athlete_id', athleteId);
      await supabase.from('workout_results').delete().eq('athlete_id', athleteId);
      await supabase.from('athlete_routines').delete().eq('athlete_id', athleteId);
      await supabase.from('enrollments').delete().eq('athlete_id', athleteId);
      await supabase.from('session_attendees').delete().eq('athlete_id', athleteId);
      await supabase.from('workout_sessions').delete().eq('athlete_id', athleteId);
      await supabase.from('notes').delete().eq('athlete_id', athleteId);

      const { error: athleteError } = await supabase.from('athletes').delete().eq('id', athleteId);
      if (athleteError) throw athleteError;

      if (profileId) {
        const { error: profileError } = await supabase.from('profiles').delete().eq('id', profileId);
        if (profileError) throw profileError;
      }

      alert("Atleta eliminado correctamente.");
      window.location.href = '/athletes-management'; 

    } catch (error) {
      console.error("Error en la eliminación completa:", error);
      alert("Error al intentar eliminar: " + (error.message || "Error desconocido"));
    } finally {
      setDeleting(false);
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
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
              athlete.status === 'active' ? 'bg-success' : 'bg-muted'
            }`}></div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-heading font-bold text-foreground truncate">
                {athlete.name}
              </h1>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold uppercase ${
                  athlete.membershipType === 'premium' 
                    ? 'bg-secondary/10 text-secondary' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <Icon name={athlete.membershipType === 'premium' ? 'Crown' : 'Shield'} size={12} />
                  {athlete.membershipType === 'premium' ? 'Premium' : 'Estándar'}
                </span>
                
                {isOffline && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold uppercase bg-warning/10 text-warning">
                    <Icon name="CloudOff" size={12} />
                    Offline
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className={`flex items-center gap-1 ${athlete.status === 'active' ? '' : 'opacity-50'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${athlete.status === 'active' ? 'bg-success' : 'bg-muted'}`}></div>
                <span className="capitalize">{athlete.status === 'active' ? 'Activo' : 'Inactivo'}</span>
              </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Icon name="Fingerprint" size={16} className="text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase font-medium">Documento</p>
                <p className="text-sm font-bold text-foreground truncate">{athlete.dni || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Icon name={isOffline ? 'MailX' : 'Mail'} size={16} className={isOffline ? 'text-warning' : 'text-primary'} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase font-medium">Email</p>
                <p className={`text-sm font-bold truncate ${isOffline ? 'text-warning italic' : 'text-foreground'}`}>
                  {athlete.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Icon name="Calendar" size={16} className="text-accent" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase font-medium">Miembro desde</p>
                <p className="text-sm font-bold text-foreground">
                  {new Date(athlete.join_date || athlete.joinDate).toLocaleDateString('es-ES')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              iconName="Trash2"
              onClick={handleDeleteAthlete}
              loading={deleting}
              className="border-error/30 text-error hover:bg-error/5"
            >
              Eliminar Atleta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AthleteHeader;
