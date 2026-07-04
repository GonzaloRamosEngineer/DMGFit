import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';

import Icon from '../../components/AppIcon';
import { useConfirm } from '../../components/ui/ConfirmProvider';
import { useToast } from '../../hooks/useToast';
import CoachesTable from './components/CoachesTable';
import CoachFormModal from './components/CoachFormModal';
import CoachAthletesModal from './components/CoachAthletesModal';
import EnableAccountModal from '../../components/EnableAccountModal';

const normalizeRelation = (value) => {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
};

const CoachesManagement = () => {
  const confirm = useConfirm();
  const { toast } = useToast();

  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [coachToEdit, setCoachToEdit] = useState(null);

  const [isAthletesModalOpen, setIsAthletesModalOpen] = useState(false);
  const [coachForAthletes, setCoachForAthletes] = useState(null);

  const [isEnableModalOpen, setIsEnableModalOpen] = useState(false);
  const [enableTarget, setEnableTarget] = useState(null);

  const fetchCoaches = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('coaches')
        .select(`
          id,
          specialization,
          bio,
          phone,
          profile_id,
          profiles:profile_id (
            full_name,
            email,
            avatar_url
          ),
          athletes:athletes(count)
        `)
        .order('id', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map((coachRow) => {
        const profile = normalizeRelation(coachRow.profiles);
        const athletesCountRelation = normalizeRelation(coachRow.athletes);

        const rawEmail = profile?.email || '';
        const isInternalEmail =
          rawEmail.includes('@dmg.internal') || rawEmail.includes('@vcfit.internal');

        return {
          id: coachRow.id,
          profileId: coachRow.profile_id,
          name: profile?.full_name || 'Sin Nombre',
          email: isInternalEmail ? 'Sin acceso a App' : rawEmail,
          rawEmail,
          avatar: profile?.avatar_url || '',
          specialization: coachRow.specialization || '',
          bio: coachRow.bio || '',
          phone: coachRow.phone || '',
          totalAthletes: Number(athletesCountRelation?.count || 0),
          needsActivation: isInternalEmail || rawEmail === '',
        };
      });

      setCoaches(mapped);
    } catch (error) {
      console.error('Error cargando profesores:', error);
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

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Eliminar profesor',
      message: '¿Seguro que deseas eliminar este profesor?',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const { error } = await supabase.from('coaches').delete().eq('id', id);
      if (error) throw error;
      toast.success('Profesor eliminado.');
      fetchCoaches();
    } catch (err) {
      toast.error('No se pudo eliminar.');
    }
  };

  const handleEnableAccount = (target) => {
    setEnableTarget({
      profileId: target.profileId,
      email:
        target.rawEmail?.includes('@dmg.internal') ||
        target.rawEmail?.includes('@vcfit.internal')
          ? ''
          : target.rawEmail,
      name: target.name,
      role: 'profesor',
    });

    setIsEnableModalOpen(true);
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
            onDelete={handleDelete}
            onViewAthletes={handleViewAthletes}
            onEnableAccount={handleEnableAccount}
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

      <EnableAccountModal
        isOpen={isEnableModalOpen}
        target={enableTarget}
        onClose={() => {
          setIsEnableModalOpen(false);
          setEnableTarget(null);
        }}
        onSuccess={fetchCoaches}
      />
    </>
  );
};

export default CoachesManagement;