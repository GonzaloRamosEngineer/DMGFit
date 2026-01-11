import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';

// Componentes Hijos
import PlanCard from './components/PlanCard';
import CreatePlanModal from './components/CreatePlanModal';
import PlanMetrics from './components/PlanMetrics';

const PlanManagement = () => {
  const { currentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Estados de Datos
  const [plans, setPlans] = useState([]);
  const [availableCoaches, setAvailableCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de UI/Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Estados de Métricas
  const [metrics, setMetrics] = useState({
    totalPlans: 0,
    activePlans: 0,
    totalEnrolled: 0,
    avgOccupancy: 0,
    monthlyRevenue: 0
  });

  // --- CARGA DE DATOS ---
  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Cargar Lista de Coaches Disponibles (Para el Modal)
      const { data: coachesData } = await supabase
        .from('coaches')
        .select('id, profiles(full_name)');
      
      const formattedCoaches = coachesData?.map(c => ({
        id: c.id,
        name: c.profiles?.full_name || 'Entrenador'
      })) || [];
      setAvailableCoaches(formattedCoaches);

      // 2. Cargar Planes con todas sus relaciones
      const { data: plansData, error } = await supabase
        .from('plans')
        .select(`
          *,
          plan_features ( feature ),
          plan_schedule ( day, time ),
          plan_coaches ( coach_id, coaches ( profiles ( full_name ) ) ),
          enrollments ( count )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 3. Formatear datos para el Frontend
      const formattedPlans = plansData.map(p => {
        // Calcular inscritos (Supabase devuelve count como array de objetos si no se usa head)
        // Ajuste: enrollment count suele venir distinto dependiendo de la versión de la API JS
        // Asumimos que enrollments es un array de objetos, tomamos su longitud
        const enrolledCount = p.enrollments?.length || 0; 

        return {
          id: p.id,
          name: p.name,
          description: p.description,
          price: Number(p.price),
          capacity: p.capacity,
          status: p.status,
          enrolled: enrolledCount,
          features: p.plan_features?.map(f => f.feature) || [],
          schedule: p.plan_schedule?.map(s => ({ day: s.day, time: s.time })) || [],
          // Mapeamos los coaches a sus nombres para mostrar en la tarjeta
          professors: p.plan_coaches?.map(pc => pc.coaches?.profiles?.full_name).filter(Boolean) || [],
          // Guardamos también los IDs de coaches para el formulario de edición
          professorIds: p.plan_coaches?.map(pc => pc.coach_id) || []
        };
      });

      setPlans(formattedPlans);
      calculateMetrics(formattedPlans);

    } catch (error) {
      console.error("Error cargando planes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const calculateMetrics = (data) => {
    const total = data.length;
    const active = data.filter(p => p.status === 'active').length;
    const enrolled = data.reduce((sum, p) => sum + p.enrolled, 0);
    const revenue = data.reduce((sum, p) => sum + (p.enrolled * p.price), 0);
    
    // Ocupación promedio ponderada
    let occupancySum = 0;
    let capacitySum = 0;
    data.forEach(p => {
        if(p.status === 'active') {
            occupancySum += p.enrolled;
            capacitySum += p.capacity;
        }
    });
    const occupancy = capacitySum > 0 ? Math.round((occupancySum / capacitySum) * 100) : 0;

    setMetrics({
      totalPlans: total,
      activePlans: active,
      totalEnrolled: enrolled,
      avgOccupancy: occupancy,
      monthlyRevenue: revenue
    });
  };

  // --- ACTIONS ---

  const handleSavePlan = async (planData) => {
    try {
      setLoading(true);
      
      // 1. Insertar/Actualizar Plan Base
      const planPayload = {
        name: planData.name,
        description: planData.description,
        price: planData.price,
        capacity: planData.capacity,
        status: planData.status || 'active'
      };

      let planId = planData.id;

      if (editingPlan) {
        // Update
        const { error } = await supabase.from('plans').update(planPayload).eq('id', planId);
        if (error) throw error;
        
        // Limpiar relaciones antiguas para re-crearlas (Estrategia simple)
        await Promise.all([
          supabase.from('plan_features').delete().eq('plan_id', planId),
          supabase.from('plan_schedule').delete().eq('plan_id', planId),
          supabase.from('plan_coaches').delete().eq('plan_id', planId)
        ]);
      } else {
        // Insert
        const { data, error } = await supabase.from('plans').insert(planPayload).select().single();
        if (error) throw error;
        planId = data.id;
      }

      // 2. Insertar Relaciones
      const featuresInsert = planData.features.map(f => ({ plan_id: planId, feature: f }));
      const scheduleInsert = planData.schedule.map(s => ({ plan_id: planId, day: s.day, time: s.time }));
      
      // Mapear nombres de profes a IDs (Ojo: El modal debe devolver IDs preferiblemente)
      // Si el modal devuelve IDs (lo ajustaremos), usamos planData.professorIds
      const coachesInsert = planData.professorIds?.map(coachId => ({ plan_id: planId, coach_id: coachId })) || [];

      await Promise.all([
        featuresInsert.length > 0 && supabase.from('plan_features').insert(featuresInsert),
        scheduleInsert.length > 0 && supabase.from('plan_schedule').insert(scheduleInsert),
        coachesInsert.length > 0 && supabase.from('plan_coaches').insert(coachesInsert)
      ]);

      await fetchData(); // Recargar todo
      setIsCreateModalOpen(false);
      setEditingPlan(null);

    } catch (error) {
      console.error("Error guardando plan:", error);
      alert("Hubo un error al guardar el plan. Revisa la consola.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('¿Estás seguro? Esta acción no se puede deshacer.')) return;
    try {
      // Nota: Si configuraste CASCADE en SQL, borrar el plan borra todo lo demás.
      // Si no, habría que borrar hijos primero. Asumimos CASCADE o borrado manual.
      const { error } = await supabase.from('plans').delete().eq('id', planId);
      if (error) throw error;
      setPlans(prev => prev.filter(p => p.id !== planId));
      calculateMetrics(plans.filter(p => p.id !== planId));
    } catch (error) {
      console.error("Error eliminando plan:", error);
    }
  };

  const handleToggleStatus = async (planId) => {
    const plan = plans.find(p => p.id === planId);
    const newStatus = plan.status === 'active' ? 'inactive' : 'active';
    
    try {
      await supabase.from('plans').update({ status: newStatus }).eq('id', planId);
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, status: newStatus } : p));
    } catch (error) {
      console.error("Error actualizando estado:", error);
    }
  };

  // --- FILTROS ---
  const filteredPlans = plans.filter(plan => {
    const matchesSearch = plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          plan.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || plan.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <Helmet>
        <title>Gestión de Planes - DigitalMatch</title>
      </Helmet>
      <div className="flex min-h-screen bg-background">
        <NavigationSidebar
          isCollapsed={sidebarCollapsed}
          userRole={currentUser?.role || 'profesor'}
          alertData={{ dashboard: 3, atletas: 5 }} 
        />
        <div className={`flex-1 transition-smooth ${sidebarCollapsed ? 'ml-20' : 'ml-60'}`}>
          <div className="p-6 lg:p-8">
            <BreadcrumbTrail items={[{ label: 'Gestión de Planes', path: '/plan-management', active: true }]} />
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Gestión de Planes</h1>
                <p className="text-muted-foreground">Administra los planes de entrenamiento disponibles</p>
              </div>
              <Button
                variant="default"
                size="md"
                iconName="Plus"
                onClick={() => {
                  setEditingPlan(null);
                  setIsCreateModalOpen(true);
                }}
              >
                Crear Nuevo Plan
              </Button>
            </div>

            {/* MÉTRICAS */}
            <PlanMetrics metrics={metrics} loading={loading} />

            {/* FILTROS */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Icon name="Search" size={20} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar planes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 px-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>

            {/* LISTA DE PLANES */}
            {loading ? (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {[1,2,3,4].map(i => <PlanCard key={i} loading={true} />)}
               </div>
            ) : filteredPlans.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onEdit={(p) => {
                      setEditingPlan(p);
                      setIsCreateModalOpen(true);
                    }}
                    onDelete={handleDeletePlan}
                    onToggleStatus={handleToggleStatus}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <Icon name="Package" size={64} color="var(--color-muted-foreground)" className="mx-auto mb-4" />
                <h3 className="text-lg font-heading font-semibold text-foreground mb-2">No se encontraron planes</h3>
                <p className="text-muted-foreground mb-4">Crea un nuevo plan para comenzar.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isCreateModalOpen && (
        <CreatePlanModal
          plan={editingPlan}
          professors={availableCoaches} // Pasamos la lista real de la DB
          onSave={handleSavePlan}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingPlan(null);
          }}
        />
      )}
    </>
  );
};

export default PlanManagement;