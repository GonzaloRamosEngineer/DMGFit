import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import CoachCard from './components/CoachCard';
import AddCoachModal from './components/AddCoachModal';

const CoachesManagement = () => {
  const { currentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchCoaches = async () => {
    setLoading(true);
    try {
      // Traemos al coach y su perfil, y contamos sus atletas asignados
      const { data, error } = await supabase
        .from('coaches')
        .select(`
          id, specialization, bio,
          profiles:profile_id (full_name, email, avatar_url),
          athletes:athletes(count)
        `);

      if (error) throw error;

      setCoaches(data.map(c => ({
        id: c.id,
        name: c.profiles?.full_name || 'Sin Nombre',
        email: c.profiles?.email,
        avatar: c.profiles?.avatar_url,
        specialization: c.specialization,
        bio: c.bio,
        totalAthletes: c.athletes?.[0]?.count || 0
      })));

    } catch (error) {
      console.error('Error cargando profesores:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoaches();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este profesor?")) return;
    // Lógica de borrado (idealmente soft delete o borrar perfil)
    alert("Funcionalidad de borrado pendiente de implementar (requiere manejo de FK)");
  };

  return (
    <>
      <Helmet><title>Gestión de Profesores - DigitalMatch</title></Helmet>
      <div className="flex min-h-screen bg-background">
        <NavigationSidebar isCollapsed={sidebarCollapsed} userRole={currentUser?.role || 'admin'} />
        
        <div className={`flex-1 transition-smooth ${sidebarCollapsed ? 'ml-20' : 'ml-60'}`}>
          <div className="p-6 lg:p-8">
            <BreadcrumbTrail items={[{ label: 'Gestión de Profesores', path: '/coaches-management', active: true }]} />
            
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-heading font-bold text-foreground">Equipo de Profesores</h1>
                <p className="text-muted-foreground">Gestiona a los entrenadores de tu gimnasio</p>
              </div>
              <Button variant="default" iconName="UserPlus" onClick={() => setIsModalOpen(true)}>
                Nuevo Profesor
              </Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1,2,3].map(i => <div key={i} className="h-64 bg-muted/20 animate-pulse rounded-xl"></div>)}
              </div>
            ) : coaches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {coaches.map(coach => (
                  <CoachCard key={coach.id} coach={coach} onDelete={handleDelete} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-border rounded-xl">
                <Icon name="Users" size={48} className="mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold text-foreground">No hay profesores registrados</h3>
                <p className="text-muted-foreground">Comienza agregando a tu staff.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <AddCoachModal 
          onClose={() => setIsModalOpen(false)} 
          onCoachAdded={() => { fetchCoaches(); setIsModalOpen(false); }} 
        />
      )}
    </>
  );
};

export default CoachesManagement;