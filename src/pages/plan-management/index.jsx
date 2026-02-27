import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { fetchPlanPricing, fetchPlanSlots, upsertPlanPricing, upsertPlanSlots } from '../../services/plans';

// Componentes Hijos
import PlanCard from './components/PlanCard';
import CreatePlanModal from './components/CreatePlanModal';
import PlanMetrics from './components/PlanMetrics';

const PlanManagement = () => {
  const { currentUser } = useAuth();
  
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

      // 1. Cargar Lista de Coaches Disponibles
      const { data: coachesData } = await supabase
        .from('coaches')
        .select('id, profiles(full_name)');
      
      const formattedCoaches = coachesData?.map(c => ({
        id: c.id,
        name: c.profiles?.full_name || 'Entrenador'
      })) || [];
      setAvailableCoaches(formattedCoaches);

      // 2. Cargar Planes
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

      // 3. Formatear datos
      const formattedPlans = await Promise.all(plansData.map(async (p) => {
        const enrolledCount = p.enrollments?.length || 0;
        const [pricingTiers, slotAvailability] = await Promise.all([
          fetchPlanPricing(p.id).catch(() => []),
          fetchPlanSlots(p.id).catch(() => []),
        ]);

        const schedule = slotAvailability.length > 0
          ? slotAvailability.map((slot) => ({
              weeklyScheduleId: slot.weekly_schedule_id,
              day_of_week: slot.day_of_week,
              day: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][slot.day_of_week] || 'Día',
              start_time: slot.start_time,
              end_time: slot.end_time,
              time: `${String(slot.start_time).slice(0, 5)} - ${String(slot.end_time).slice(0, 5)}`,
              capacity: slot.capacity,
              remaining: slot.remaining,
            }))
          : (p.plan_schedule?.map(s => ({ day: s.day, time: s.time })) || []);

        return {
          id: p.id,
          name: p.name,
          description: p.description,
          price: Number(p.price),
          capacity: p.capacity,
          status: p.status,
          enrolled: enrolledCount,
          features: p.plan_features?.map(f => f.feature) || [],
          pricingTiers,
          schedule,
          professors: p.plan_coaches?.map(pc => pc.coaches?.profiles?.full_name).filter(Boolean) || [],
          professorIds: p.plan_coaches?.map(pc => pc.coach_id) || []
        };
      }));

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
      
      const planPayload = {
        name: planData.name,
        description: planData.description,
        price: planData.price,
        capacity: planData.capacity,
        status: planData.status || 'active'
      };

      let planId = planData.id;

      if (editingPlan) {
        const { error } = await supabase.from('plans').update(planPayload).eq('id', planId);
        if (error) throw error;
        
        await Promise.all([
          supabase.from('plan_features').delete().eq('plan_id', planId),
          supabase.from('plan_schedule').delete().eq('plan_id', planId),
          supabase.from('plan_coaches').delete().eq('plan_id', planId)
        ]);
      } else {
        const { data, error } = await supabase.from('plans').insert(planPayload).select().single();
        if (error) throw error;
        planId = data.id;
      }

      const normalizedFeatures = Array.from(
        new Set((planData.features || []).map((feature) => feature.trim()).filter(Boolean))
      );
      const featuresInsert = normalizedFeatures.map((feature) => ({ plan_id: planId, feature }));
      const scheduleInsert = planData.schedule.map(s => ({ plan_id: planId, day: s.day, time: s.time }));
      const coachesInsert = planData.professorIds?.map(coachId => ({ plan_id: planId, coach_id: coachId })) || [];

      await Promise.all([
        featuresInsert.length > 0 && supabase.from('plan_features').insert(featuresInsert),
        scheduleInsert.length > 0 && supabase.from('plan_schedule').insert(scheduleInsert),
        coachesInsert.length > 0 && supabase.from('plan_coaches').insert(coachesInsert),
        upsertPlanPricing(planId, planData.pricingTiers || []),
        upsertPlanSlots(planId, planData.scheduleSlots || []),
      ]);

      await fetchData(); 
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
      calculateMetrics(plans.map(p => p.id === planId ? { ...p, status: newStatus } : p));
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
        <title>Gestión de Planes - VC Fit</title>
      </Helmet>
      
      {/* Contenedor Principal con estilo unificado */}
      <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 md:p-10 pb-24">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <BreadcrumbTrail 
                items={[
                  { label: 'Gestión de Planes', path: '/plan-management', active: true }
                ]} 
              />
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mt-2">
                Gestión de Planes
              </h1>
              <p className="text-slate-500 font-medium mt-1">
                Administra los servicios, precios y horarios de tu centro
              </p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
              <button
                onClick={() => {
                  setEditingPlan(null);
                  setIsCreateModalOpen(true);
                }}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 text-xs uppercase tracking-widest transition-all"
              >
                <Icon name="Plus" size={16} /> Crear Plan
              </button>
            </div>
          </div>

          {/* MÉTRICAS (Componente Hijo) */}
          <div className="mb-8">
            <PlanMetrics metrics={metrics} loading={loading} />
          </div>

          {/* ÁREA DE CONTENIDO (Filtros + Lista) */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4 sm:p-6 md:p-8">
            
            {/* FILTROS Y BÚSQUEDA */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              
              {/* Buscador */}
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Icon name="Search" size={18} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar planes por nombre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all"
                />
              </div>

              {/* Selector de Estado */}
              <div className="sm:w-48 relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium appearance-none focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 cursor-pointer transition-all"
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                  <Icon name="ChevronDown" size={16} />
                </div>
              </div>
            </div>

            {/* LISTA DE PLANES (Grid Responsivo) */}
            {loading ? (
               <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                 {[1,2,3].map(i => <PlanCard key={i} loading={true} />)}
               </div>
            ) : filteredPlans.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
              <div className="text-center py-20 px-4 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                  <Icon name="Package" size={28} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-700 mb-1">
                  {searchQuery ? "No hay coincidencias" : "No hay planes creados"}
                </h3>
                <p className="text-sm font-medium text-slate-500">
                  {searchQuery 
                    ? "Prueba buscando con otros términos o cambia los filtros."
                    : "Crea tu primer plan de entrenamiento para empezar."}
                </p>
                {!searchQuery && (
                  <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-6 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                  >
                    Crear mi primer plan
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isCreateModalOpen && (
        <CreatePlanModal
          plan={editingPlan}
          professors={availableCoaches}
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