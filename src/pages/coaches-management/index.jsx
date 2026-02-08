import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import CoachCard from './components/CoachCard';
import CoachFormModal from './components/CoachFormModal';
import CoachAthletesModal from './components/CoachAthletesModal';
import EnableAccountModal from '../../components/EnableAccountModal'; // Importar el modal

const CoachesManagement = () => {
  const { currentUser } = useAuth();
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Modales
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [coachToEdit, setCoachToEdit] = useState(null);
  
  const [isAthletesModalOpen, setIsAthletesModalOpen] = useState(false);
  const [coachForAthletes, setCoachForAthletes] = useState(null);

  // --- NUEVOS ESTADOS PARA HABILITACIÓN ---
  const [isEnableModalOpen, setIsEnableModalOpen] = useState(false);
  const [enableTarget, setEnableTarget] = useState(null);

  const fetchCoaches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select(`
          id, specialization, bio, phone, profile_id,
          profiles:profile_id (full_name, email, avatar_url),
          athletes:athletes(count)
        `);

      if (error) throw error;

      setCoaches(data.map(c => {
        const rawEmail = c.profiles?.email || "";
        const isInternalEmail = rawEmail.includes('@dmg.internal');

        return {
          id: c.id,
          profileId: c.profile_id, // Guardamos el profile_id para el modal
          name: c.profiles?.full_name || 'Sin Nombre',
          email: isInternalEmail ? "Sin acceso a App" : rawEmail,
          rawEmail: rawEmail, // Guardamos el original para procesar
          avatar: c.profiles?.avatar_url,
          specialization: c.specialization,
          bio: c.bio,
          phone: c.phone,
          totalAthletes: c.athletes?.[0]?.count || 0,
          needsActivation: isInternalEmail || rawEmail === "" // Lógica de activación
        };
      }));

    } catch (error) {
      console.error('Error cargando profesores:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoaches();
  }, []);

  // Handlers
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
    if (!window.confirm("¿Seguro que deseas eliminar este profesor?")) return;
    try {
      const { error } = await supabase.from('coaches').delete().eq('id', id);
      if (error) throw error;
      fetchCoaches();
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  };

  return (
    <>
      <Helmet>
        <title>Gestión de Profesores - VC Fit</title>
      </Helmet>
      
      <div className="p-4 md:p-6 lg:p-8 w-full">
        <div className="max-w-7xl mx-auto">
          <BreadcrumbTrail 
            items={[
              { label: 'Gestión de Profesores', path: '/coaches-management', active: true }
            ]} 
          />
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-2">
                Equipo de Profesores
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Gestiona a los entrenadores y sus asignaciones
              </p>
            </div>
            <Button variant="default" iconName="UserPlus" iconPosition="left" onClick={handleCreate}>
              Nuevo Profesor
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="h-64 bg-muted/20 animate-pulse rounded-xl"></div>
              ))}
            </div>
          ) : coaches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {coaches.map(coach => (
                <CoachCard 
                  key={coach.id} 
                  coach={coach} 
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onViewAthletes={handleViewAthletes}
                  // --- PASAR LA FUNCIÓN DE HABILITACIÓN ---
                  onEnableAccount={(target) => {
                    setEnableTarget({
                      profileId: target.profileId,
                      email: target.rawEmail?.includes("@dmg.internal") ? "" : target.rawEmail,
                      name: target.name,
                      role: 'profesor'
                    });
                    setIsEnableModalOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <Icon name="Users" size={48} className="mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No hay profesores registrados
              </h3>
              <p className="text-muted-foreground">Comienza agregando a tu staff.</p>
            </div>
          )}
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

      {/* Modal de Habilitación de Cuenta */}
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