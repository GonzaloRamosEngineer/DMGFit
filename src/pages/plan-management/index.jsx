import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { mockPlans, mockProfessors } from '../../data/mockData';
import PlanCard from './components/PlanCard';
import CreatePlanModal from './components/CreatePlanModal';

const PlanManagement = () => {
  const { currentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [plans, setPlans] = useState(mockPlans);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const alertData = {
    dashboard: 3,
    atletas: 5,
    rendimiento: 2,
    pagos: 12
  };

  const breadcrumbItems = [
    { label: 'Gestión de Planes', path: '/plan-management', active: true }
  ];

  const filteredPlans = plans?.filter(plan => {
    const matchesSearch = plan?.name?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
                         plan?.description?.toLowerCase()?.includes(searchQuery?.toLowerCase());
    const matchesStatus = filterStatus === 'all' || plan?.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreatePlan = (newPlan) => {
    const plan = {
      id: `PLAN-${String(plans?.length + 1)?.padStart(3, '0')}`,
      ...newPlan,
      enrolled: 0,
      status: 'active'
    };
    setPlans([...plans, plan]);
    setIsCreateModalOpen(false);
  };

  const handleEditPlan = (updatedPlan) => {
    setPlans(plans?.map(p => p?.id === updatedPlan?.id ? updatedPlan : p));
    setEditingPlan(null);
    setIsCreateModalOpen(false);
  };

  const handleDeletePlan = (planId) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este plan?')) {
      setPlans(plans?.filter(p => p?.id !== planId));
    }
  };

  const handleToggleStatus = (planId) => {
    setPlans(plans?.map(p =>
      p?.id === planId ? { ...p, status: p?.status === 'active' ? 'inactive' : 'active' } : p
    ));
  };

  const openEditModal = (plan) => {
    setEditingPlan(plan);
    setIsCreateModalOpen(true);
  };

  const totalPlans = plans?.length || 0;
  const activePlans = plans?.filter(p => p?.status === 'active')?.length || 0;
  const totalEnrolled = plans?.reduce((sum, p) => sum + (p?.enrolled || 0), 0);
  const avgOccupancy = plans?.length > 0
    ? Math.round(plans?.reduce((sum, p) => sum + ((p?.enrolled || 0) / (p?.capacity || 1)) * 100, 0) / plans?.length)
    : 0;

  return (
    <>
      <Helmet>
        <title>Gestión de Planes - DigitalMatch</title>
      </Helmet>
      <div className="flex min-h-screen bg-background">
        <NavigationSidebar
          isCollapsed={sidebarCollapsed}
          alertData={alertData}
        />
        <div className={`flex-1 transition-smooth ${sidebarCollapsed ? 'ml-20' : 'ml-60'}`}>
          <div className="p-6 lg:p-8">
            <BreadcrumbTrail items={breadcrumbItems} />
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
                  Gestión de Planes
                </h1>
                <p className="text-muted-foreground">
                  Administra los planes de entrenamiento disponibles
                </p>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon name="Package" size={20} color="var(--color-primary)" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">{totalPlans}</p>
                    <p className="text-sm text-muted-foreground">Total Planes</p>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                    <Icon name="CheckCircle" size={20} color="var(--color-success)" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">{activePlans}</p>
                    <p className="text-sm text-muted-foreground">Planes Activos</p>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                    <Icon name="Users" size={20} color="var(--color-accent)" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">{totalEnrolled}</p>
                    <p className="text-sm text-muted-foreground">Total Inscritos</p>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                    <Icon name="TrendingUp" size={20} color="var(--color-secondary)" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">{avgOccupancy}%</p>
                    <p className="text-sm text-muted-foreground">Ocupación Promedio</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Icon
                  name="Search"
                  size={20}
                  color="var(--color-muted-foreground)"
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                />
                <input
                  type="text"
                  placeholder="Buscar planes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e?.target?.value)}
                  className="w-full h-10 pl-10 pr-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e?.target?.value)}
                className="h-10 px-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>

            {filteredPlans?.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredPlans?.map((plan) => (
                  <PlanCard
                    key={plan?.id}
                    plan={plan}
                    onEdit={openEditModal}
                    onDelete={handleDeletePlan}
                    onToggleStatus={handleToggleStatus}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <Icon name="Package" size={64} color="var(--color-muted-foreground)" className="mx-auto mb-4" />
                <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
                  {searchQuery || filterStatus !== 'all' ? 'No se encontraron planes' : 'No hay planes creados'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || filterStatus !== 'all' ?'Intenta con otros filtros de búsqueda' :'Crea tu primer plan para comenzar'}
                </p>
                {!searchQuery && filterStatus === 'all' && (
                  <Button
                    variant="default"
                    size="md"
                    iconName="Plus"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    Crear Primer Plan
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {isCreateModalOpen && (
        <CreatePlanModal
          plan={editingPlan}
          professors={mockProfessors}
          onSave={editingPlan ? handleEditPlan : handleCreatePlan}
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