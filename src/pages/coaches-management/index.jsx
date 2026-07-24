import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';

import Icon from '../../components/AppIcon';
import { useConfirm } from '../../components/ui/ConfirmProvider';
import { useToast } from '../../hooks/useToast';
import CoachesTable from './components/CoachesTable';
import CoachFormModal from './components/CoachFormModal';
import CoachAthletesModal from './components/CoachAthletesModal';

const CoachesManagement = () => {
  const confirm = useConfirm();
  const { toast } = useToast();

  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [coachToEdit, setCoachToEdit] = useState(null);

  const [isAthletesModalOpen, setIsAthletesModalOpen] = useState(false);
  const [coachForAthletes, setCoachForAthletes] = useState(null);

  const fetchCoaches = async () => {
    setLoading(true);

    try {
      // list_coaches_admin devuelve el estado REAL de acceso (has_login = existe
      // usuario de auth) en vez de inferirlo del email, y el flag de archivado.
      const { data, error } = await supabase.rpc('list_coaches_admin');

      if (error) throw error;

      const mapped = (data || []).map((row) => {
        const rawEmail = row.email || '';
        const isInternalEmail =
          rawEmail.includes('@dmg.internal') || rawEmail.includes('@vcfit.internal');

        return {
          id: row.id,
          profileId: row.profile_id,
          name: row.full_name || 'Sin Nombre',
          // email visible solo si es un correo de contacto real (no el interno)
          email: isInternalEmail || !rawEmail ? '' : rawEmail,
          rawEmail,
          avatar: row.avatar_url || '',
          specialization: row.specialization || '',
          bio: row.bio || '',
          dni: row.dni || '',
          phone: row.phone || '',
          totalAthletes: Number(row.total_athletes || 0),
          hasLogin: !!row.has_login,
          needsActivation: !row.has_login,
          archived: !!row.archived_at,
        };
      });

      setCoaches(mapped);
    } catch (error) {
      console.error('Error cargando profesores:', error);
      toast.error('No se pudieron cargar los profesores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoaches();
  }, []);

  const handleCreate = () => {
    setCoachToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleEdit = (coach) => {
    setCoachToEdit(coach);
    setIsFormModalOpen(true);
  };

  const handleViewAthletes = (coach) => {
    setCoachForAthletes(coach);
    setIsAthletesModalOpen(true);
  };

  // Archivar = deshabilitar sin perder historial (conserva notas/asistencia; bloquea login).
  const handleArchive = async (coach) => {
    const ok = await confirm({
      title: 'Archivar profesor',
      message: `${coach.name} saldrá de la lista activa y no podrá ingresar a la app. Su historial (notas, asistencia, sesiones) se conserva. Podés restaurarlo cuando quieras.`,
      confirmLabel: 'Archivar',
    });
    if (!ok) return;
    try {
      const { error } = await supabase.rpc('set_coach_archived', { p_coach_id: coach.id, p_archived: true });
      if (error) throw error;
      toast.success(`${coach.name} archivado.`);
      fetchCoaches();
    } catch (err) {
      toast.error(err.message || 'No se pudo archivar.');
    }
  };

  const handleRestore = async (coach) => {
    try {
      const { error } = await supabase.rpc('set_coach_archived', { p_coach_id: coach.id, p_archived: false });
      if (error) throw error;
      toast.success(`${coach.name} restaurado.`);
      fetchCoaches();
    } catch (err) {
      toast.error(err.message || 'No se pudo restaurar.');
    }
  };

  // Borrado total: solo para demos/errores. Irreversible.
  const handleHardDelete = async (coach) => {
    const ok = await confirm({
      title: 'Eliminar definitivamente',
      message: `Esto borra a ${coach.name}, su acceso y sus datos operativos (sesiones, rutinas, notas). El historial de accesos se conserva sin su nombre. Es IRREVERSIBLE. ¿Continuar?`,
      confirmLabel: 'Eliminar definitivo',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const { error } = await supabase.rpc('delete_coach_hard', { p_coach_id: coach.id });
      if (error) throw error;
      toast.success(`${coach.name} eliminado.`);
      fetchCoaches();
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar.');
    }
  };

  // Habilitar acceso por DNI (un clic, sin email). Usuario y clave = DNI.
  const handleEnableAccount = async (coach) => {
    if (!coach?.dni) {
      toast.error('El profesor no tiene DNI cargado. Editá su ficha y agregá el DNI primero.');
      return;
    }
    const ok = await confirm({
      title: 'Habilitar acceso',
      message: `Se creará el acceso de ${coach.name} con usuario y clave = su DNI (${coach.dni}). Podrá cambiar la clave desde su perfil.`,
      confirmLabel: 'Habilitar',
    });
    if (!ok) return;
    try {
      const { data, error } = await supabase.functions.invoke('activate-coach', { body: { coach_id: coach.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.already ? 'El profesor ya tenía acceso.' : `Acceso habilitado (usuario y clave: ${coach.dni}).`);
      fetchCoaches();
    } catch (err) {
      toast.error(err.message || 'No se pudo habilitar el acceso.');
    }
  };

  return (
    <>
      <Helmet>
        <title>Gestión de Profesores - VC Fit</title>
      </Helmet>

      <div className="flex flex-col gap-4 lg:gap-5 lg:h-[calc(100vh-4rem)]">
        {/* Header compacto */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">
              Equipo de Profesores
            </h1>
            <p className="text-sm text-text-secondary font-medium mt-0.5">
              Gestiona a los entrenadores y sus asignaciones
            </p>
          </div>

          <button
            onClick={handleCreate}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 shadow-md hover:-translate-y-0.5 text-xs uppercase tracking-widest transition-all w-full md:w-auto"
          >
            <Icon name="UserPlus" size={16} />
            Nuevo Profesor
          </button>
        </div>

        {/* Tabla: única card que llena el alto restante */}
        <div className="lg:flex-1 lg:min-h-0">
          <CoachesTable
            coaches={coaches}
            loading={loading}
            onEdit={handleEdit}
            onViewAthletes={handleViewAthletes}
            onEnableAccount={handleEnableAccount}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onHardDelete={handleHardDelete}
          />
        </div>
      </div>

      {/* Modales */}
      {isFormModalOpen && (
        <CoachFormModal
          onClose={() => setIsFormModalOpen(false)}
          onSuccess={fetchCoaches}
          coachToEdit={coachToEdit}
        />
      )}

      {isAthletesModalOpen && (
        <CoachAthletesModal
          coach={coachForAthletes}
          onClose={() => setIsAthletesModalOpen(false)}
        />
      )}
    </>
  );
};

export default CoachesManagement;