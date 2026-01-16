import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import AlertBadge from './AlertBadge';
import { useAuth } from '../../contexts/AuthContext';

const NavigationSidebar = ({ isCollapsed = false, alertData = {} }) => {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { currentUser, logout } = useAuth();

  const allMenuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      path: '/main-dashboard',
      badge: alertData?.dashboard || 0,
      roles: ['admin', 'profesor']
    },
    {
      id: 'profesor-dashboard',
      label: 'Mi Dashboard',
      icon: 'LayoutDashboard',
      path: '/professor-dashboard',
      badge: alertData?.dashboard || 0,
      roles: ['profesor']
    },
    {
      id: 'athlete-portal',
      label: 'Mi Portal',
      icon: 'Home',
      path: '/athlete-portal',
      badge: 0,
      roles: ['atleta']
    },
    // --- NUEVO ITEM AGREGADO ---
    {
      id: 'profesores',
      label: 'Profesores',
      icon: 'Briefcase', // Icono sugerido
      path: '/coaches-management',
      badge: 0,
      roles: ['admin'] // Solo admin puede gestionar coaches
    },
    // ---------------------------
    {
      id: 'atletas',
      label: 'Atletas',
      icon: 'Users',
      path: '/athletes-management',
      badge: alertData?.atletas || 0,
      roles: ['admin', 'profesor'] // Ajustado para que los profes también vean la lista general
    },
    {
      id: 'planes',
      label: 'Planes',
      icon: 'Package',
      path: '/plan-management',
      badge: 0,
      roles: ['admin']
    },
    {
      id: 'rendimiento',
      label: 'Rendimiento',
      icon: 'TrendingUp',
      path: '/performance-analytics',
      badge: alertData?.rendimiento || 0,
      roles: ['admin', 'profesor']
    },
    {
      id: 'pagos',
      label: 'Pagos',
      icon: 'CreditCard',
      path: '/payment-management',
      badge: alertData?.pagos || 0,
      roles: ['admin']
    },
    {
      id: 'pdf-export',
      label: 'Exportar PDF',
      icon: 'FileText',
      path: '/pdf-export-center',
      badge: 0,
      roles: ['admin', 'profesor']
    },
    {
      id: 'access-control',
      label: 'Modo Kiosco',
      icon: 'Monitor', // Asegúrate de tener este icono o usa 'Maximize'
      path: '/access-control',
      badge: 0,
      roles: ['admin']
    },
    {
      id: 'history-access',
      label: 'Historial Accesos',
      icon: 'Monitor', // Asegúrate de tener este icono o usa 'Maximize'
      path: '/access-history',
      badge: 0,
      roles: ['admin']
    },
    {
  id: 'horarios',
  label: 'Planificación',
  icon: 'Calendar',
  path: '/class-schedule',
  roles: ['admin', 'profesor']
}

  ];

  const menuItems = allMenuItems?.filter(item => 
    item?.roles?.includes(currentUser?.role)
  );

  const isActive = (path) => {
    return location?.pathname === path || location?.pathname?.startsWith(path + '/');
  };

  const handleMobileToggle = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileOpen(false);
  };

  return (
    <>
      <button
        onClick={handleMobileToggle}
        className="fixed top-4 left-4 z-50 lg:hidden bg-card p-3 rounded-lg shadow-lg transition-smooth hover:bg-muted"
        aria-label="Toggle navigation menu"
      >
        <Icon name={isMobileOpen ? 'X' : 'Menu'} size={24} color="var(--color-foreground)" />
      </button>
      <aside
        className={`
          fixed lg:fixed top-0 left-0 h-full bg-card border-r border-border
          transition-smooth z-nav
          ${isCollapsed ? 'w-20' : 'w-60'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className={`sidebar-header ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
          <div className="sidebar-logo">
            <Icon name="Dumbbell" size={isCollapsed ? 20 : 28} color="#FFFFFF" />
          </div>
          {!isCollapsed && (
            <span className="ml-3 text-lg font-heading font-semibold text-foreground">
              DigitalMatch
            </span>
          )}
        </div>

        <nav className="flex flex-col p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar">
          {menuItems?.map((item) => (
            <Link
              key={item?.id}
              to={item?.path}
              onClick={closeMobileMenu}
              className={`
                relative flex items-center h-12 px-4 rounded-lg
                transition-smooth group
                ${isActive(item?.path)
                  ? 'bg-primary/10 text-primary shadow-glow-primary'
                  : 'text-foreground hover:bg-muted hover:text-primary'
                }
              `}
              title={isCollapsed ? item?.label : ''}
            >
              <Icon
                name={item?.icon}
                size={24}
                color={isActive(item?.path) ? 'var(--color-primary)' : 'currentColor'}
              />
              {!isCollapsed && (
                <span className="ml-3 font-medium">{item?.label}</span>
              )}
              {item?.badge > 0 && (
                <AlertBadge
                  count={item?.badge}
                  severity={item?.id === 'pagos' ? 'critical' : 'warning'}
                  position="right"
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Icon
                name={currentUser?.role === 'admin' ? 'Shield' : currentUser?.role === 'profesor' ? 'GraduationCap' : 'User'}
                size={20}
                color="var(--color-primary)"
              />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{currentUser?.name || 'Usuario'}</p>
                <p className="text-xs text-muted-foreground capitalize">{currentUser?.role || 'coach'}</p>
              </div>
            )}
            {!isCollapsed && (
              <button
                onClick={logout}
                className="p-2 hover:bg-muted rounded-lg transition-smooth"
                title="Cerrar sesión"
              >
                <Icon name="LogOut" size={16} color="var(--color-muted-foreground)" />
              </button>
            )}
          </div>
        </div>
      </aside>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-background z-40 lg:hidden opacity-50"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default NavigationSidebar;