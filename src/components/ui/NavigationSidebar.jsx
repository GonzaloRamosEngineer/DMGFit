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
      roles: ['admin', 'profesor'],
      description: 'Vista general del sistema'
    },
    {
      id: 'profesor-dashboard',
      label: 'Mi Dashboard',
      icon: 'LayoutDashboard',
      path: '/professor-dashboard',
      badge: alertData?.dashboard || 0,
      roles: ['profesor'],
      description: 'Panel de control personal'
    },
    {
      id: 'athlete-portal',
      label: 'Mi Portal',
      icon: 'Home',
      path: '/athlete-portal',
      badge: 0,
      roles: ['atleta'],
      description: 'Portal del atleta'
    },
    {
      id: 'profesores',
      label: 'Profesores',
      icon: 'GraduationCap',
      path: '/coaches-management',
      badge: 0,
      roles: ['admin'],
      description: 'Gestión de entrenadores'
    },
    {
      id: 'atletas',
      label: 'Atletas',
      icon: 'Users',
      path: '/athletes-management',
      badge: alertData?.atletas || 0,
      roles: ['admin', 'profesor'],
      description: 'Gestión de atletas'
    },
    {
      id: 'planes',
      label: 'Planes',
      icon: 'Package',
      path: '/plan-management',
      badge: 0,
      roles: ['admin'],
      description: 'Planes de entrenamiento'
    },
    {
      id: 'rendimiento',
      label: 'Rendimiento',
      icon: 'TrendingUp',
      path: '/performance-analytics',
      badge: alertData?.rendimiento || 0,
      roles: ['admin', 'profesor'],
      description: 'Análisis de rendimiento'
    },
    {
      id: 'pagos',
      label: 'Pagos',
      icon: 'CreditCard',
      path: '/payment-management',
      badge: alertData?.pagos || 0,
      roles: ['admin'],
      description: 'Gestión de pagos'
    },
    {
      id: 'pdf-export',
      label: 'Exportar PDF',
      icon: 'FileText',
      path: '/pdf-export-center',
      badge: 0,
      roles: ['admin', 'profesor'],
      description: 'Centro de exportación'
    },
    {
      id: 'access-control',
      label: 'Modo Kiosco',
      icon: 'Monitor',
      path: '/access-control',
      badge: 0,
      roles: ['admin'],
      description: 'Control de acceso',
      openInNewTab: true // ← ÚNICA LÍNEA AGREGADA
    },
    {
      id: 'history-access',
      label: 'Historial Accesos',
      icon: 'ClipboardList',
      path: '/access-history',
      badge: 0,
      roles: ['admin'],
      description: 'Registro de accesos'
    },
    {
      id: 'horarios',
      label: 'Planificación',
      icon: 'Calendar',
      path: '/class-schedule',
      roles: ['admin', 'profesor'],
      description: 'Calendario de clases'
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

  // Función para obtener las iniciales del usuario
  const getUserInitials = (name) => {
    if (!name) return 'US';
    const names = name.trim().split(' ');
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  };

  // Traducción de roles
  const getRoleLabel = (role) => {
    const roleLabels = {
      'admin': 'Administrador',
      'profesor': 'Profesor',
      'atleta': 'Atleta'
    };
    return roleLabels[role] || role;
  };

  return (
    <>
      {/* Botón Hamburguesa Mobile */}
      <button
        onClick={handleMobileToggle}
        className="fixed top-4 left-4 z-50 lg:hidden bg-card p-3 rounded-lg shadow-lg transition-smooth hover:bg-muted border border-border"
        aria-label="Toggle navigation menu"
      >
        <Icon name={isMobileOpen ? 'X' : 'Menu'} size={24} color="var(--color-foreground)" />
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:fixed top-0 left-0 h-full bg-card border-r border-border
          transition-all duration-300 ease-in-out z-nav
          flex flex-col
          ${isCollapsed ? 'w-20' : 'w-60'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header con Logo */}
        <div className={`flex items-center h-16 px-4 border-b border-border flex-shrink-0 ${
          isCollapsed ? 'justify-center' : 'justify-start'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon name="Dumbbell" size={24} color="#FFFFFF" />
            </div>
            {!isCollapsed && (
              <span className="text-lg font-heading font-bold text-foreground whitespace-nowrap">
                VC Fit
              </span>
            )}
          </div>
        </div>

        {/* Navigation Menu - Con scroll */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {menuItems?.map((item) => (
            <Link
              key={item?.id}
              to={item?.path}
              onClick={(e) => {
                // ← ÚNICO CAMBIO: Lógica para abrir en nueva pestaña
                if (item?.openInNewTab) {
                  e.preventDefault();
                  window.open(item.path, '_blank', 'noopener,noreferrer');
                } else {
                  closeMobileMenu();
                }
              }}
              target={item?.openInNewTab ? '_blank' : undefined}
              rel={item?.openInNewTab ? 'noopener noreferrer' : undefined}
              className={`
                relative flex items-center h-11 px-3 rounded-lg
                transition-all duration-200 group
                ${isActive(item?.path)
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-foreground hover:bg-muted hover:text-primary'
                }
                ${isCollapsed ? 'justify-center' : 'justify-start'}
              `}
              title={isCollapsed ? item?.label : ''}
            >
              <div className="flex-shrink-0">
                <Icon
                  name={item?.icon}
                  size={20}
                  color={isActive(item?.path) ? 'var(--color-primary)' : 'currentColor'}
                />
              </div>
              
              {!isCollapsed && (
                <>
                  <span className="ml-3 font-medium text-sm truncate">{item?.label}</span>
                  {item?.badge > 0 && (
                    <AlertBadge
                      count={item?.badge}
                      severity={item?.id === 'pagos' ? 'critical' : 'warning'}
                      position="right"
                    />
                  )}
                </>
              )}
              
              {/* Badge cuando está colapsado - posición absoluta */}
              {isCollapsed && item?.badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-error text-white text-[10px] font-bold rounded-full px-1">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User Info Section - Mejorada */}
        <div className="border-t border-border bg-card flex-shrink-0">
          <div className={`p-4 ${isCollapsed ? 'px-2' : 'px-4'}`}>
            <div className={`flex items-center gap-3 ${isCollapsed ? 'flex-col' : 'flex-row'}`}>
              {/* Avatar/Icono del Usuario */}
              <div className="relative flex-shrink-0">
                {currentUser?.avatar_url ? (
                  <img 
                    src={currentUser.avatar_url} 
                    alt={currentUser?.name || 'Usuario'}
                    className="w-10 h-10 rounded-full object-cover border-2 border-primary/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center border-2 border-primary/30">
                    <span className="text-sm font-bold text-primary">
                      {getUserInitials(currentUser?.name)}
                    </span>
                  </div>
                )}
                
                {/* Indicador de Estado Online */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success border-2 border-card rounded-full" />
              </div>

              {/* Info del Usuario - Solo visible cuando no está colapsado */}
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate leading-tight mb-0.5">
                    {currentUser?.name || 'Usuario'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate leading-tight mb-0.5">
                    {currentUser?.email || 'usuario@email.com'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={`
                      px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                      ${currentUser?.role === 'admin' ? 'bg-primary/15 text-primary' : ''}
                      ${currentUser?.role === 'profesor' ? 'bg-accent/15 text-accent' : ''}
                      ${currentUser?.role === 'atleta' ? 'bg-success/15 text-success' : ''}
                    `}>
                      {getRoleLabel(currentUser?.role)}
                    </div>
                  </div>
                </div>
              )}

              {/* Botón Logout */}
              <button
                onClick={logout}
                className={`
                  p-2 hover:bg-error/10 rounded-lg transition-all duration-200 
                  hover:text-error group flex-shrink-0
                  ${isCollapsed ? 'w-full justify-center mt-2' : ''}
                `}
                title="Cerrar sesión"
              >
                <Icon 
                  name="LogOut" 
                  size={18} 
                  color="currentColor" 
                  className="group-hover:scale-110 transition-transform"
                />
              </button>
            </div>

            {/* Versión Colapsada - Tooltip con info */}
            {isCollapsed && (
              <div className="mt-2 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                  {currentUser?.role?.substring(0, 3)}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Overlay para Mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default NavigationSidebar;