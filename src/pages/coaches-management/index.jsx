import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';
import CoachCard from './components/CoachCard';
import CoachFormModal from './components/CoachFormModal';
import CoachAthletesModal from './components/CoachAthletesModal';
import EnableAccountModal from '../../components/EnableAccountModal'; 

const CoachesManagement = () => {
  const { currentUser } = useAuth();
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Modales
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
          id, specialization, bio, phone, profile_id,
          profiles:profile_id (full_name, email, avatar_url),
          athletes:athletes(count)
        `);

      if (error) throw error;

      setCoaches(data.map(c => {
        const rawEmail = c.profiles?.email || "";
        const isInternalEmail = rawEmail.includes('@dmg.internal') || rawEmail.includes('@vcfit.internal');

        return {
          id: c.id,
          profileId: c.profile_id,
          name: c.profiles?.full_name || 'Sin Nombre',
          email: isInternalEmail ? "Sin acceso a App" : rawEmail,
          rawEmail: rawEmail, 
          avatar: c.profiles?.avatar_url,
          specialization: c.specialization,
          bio: c.bio,
          phone: c.phone,
          totalAthletes: c.athletes?.[0]?.count || 0,
          needsActivation: isInternalEmail || rawEmail === "" 
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
      
      {/* Fondo y contenedor general unificado */}
      <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 md:p-10 pb-24">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <BreadcrumbTrail 
                items={[
                  { label: 'Gestión de Profesores', path: '/coaches-management', active: true }
                ]} 
              />
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mt-2">
                Equipo de Profesores
              </h1>
              <p className="text-slate-500 font-medium mt-1">
                Gestiona a los entrenadores y sus asignaciones
              </p>
            </div>
            
            <button 
              onClick={handleCreate}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 text-xs uppercase tracking-widest transition-all w-full md:w-auto mt-2 md:mt-0"
            >
              <Icon name="UserPlus" size={16} /> Nuevo Profesor
            </button>
          </div>

          {/* Contenedor de la Grilla */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4 sm:p-6 md:p-8">
            
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                <Icon name="Users" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">Staff Activo</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {loading ? "Cargando..." : `${coaches.length} entrenadores`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-[280px] bg-slate-50 border border-slate-100 animate-pulse rounded-3xl"></div>
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
                    onEnableAccount={(target) => {
                      setEnableTarget({
                        profileId: target.profileId,
                        email: target.rawEmail?.includes("@dmg.internal") || target.rawEmail?.includes("@vcfit.internal")
                          ? ""
                          : target.rawEmail,
                        name: target.name,
                        role: 'profesor'
                      });
                      setIsEnableModalOpen(true);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 px-4 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                  <Icon name="Users" size={28} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-700 mb-1">
                  No hay profesores registrados
                </h3>
                <p className="text-sm font-medium text-slate-500 mb-6">
                  Comienza agregando a tu staff para poder asignarles atletas y clases.
                </p>
                <button 
                  onClick={handleCreate}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                >
                  Crear mi primer profesor
                </button>
              </div>
            )}
          </div>

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