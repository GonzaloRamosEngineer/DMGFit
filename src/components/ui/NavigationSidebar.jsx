import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Icon from "../AppIcon";
import AlertBadge from "./AlertBadge";
import { useAuth } from "../../contexts/AuthContext";

const NavigationSidebar = ({
  isCollapsed = false,
  onToggleCollapse,
  alertData = {},
}) => {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { currentUser, logout } = useAuth();

  const allMenuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "LayoutDashboard",
      path: "/main-dashboard",
      badge: alertData?.dashboard || 0,
      roles: ["admin"],
      description: "Vista general del sistema",
    },
    {
      id: "athlete-portal",
      label: "Mi Portal",
      icon: "Home",
      path: "/athlete-portal",
      badge: 0,
      roles: ["atleta"],
      description: "Portal del atleta",
    },
    {
      id: "profesores",
      label: "Profesores",
      icon: "GraduationCap",
      path: "/coaches-management",
      badge: 0,
      roles: ["admin"],
      description: "Gestión de entrenadores",
    },
    {
      id: "atletas",
      label: "Atletas",
      icon: "Users",
      path: "/athletes-management",
      badge: alertData?.atletas || 0,
      roles: ["admin"],
      description: "Gestión de atletas",
    },
    {
      id: "planes",
      label: "Planes",
      icon: "Package",
      path: "/plan-management",
      badge: 0,
      roles: ["admin"],
      description: "Planes de entrenamiento",
    },
    {
      id: "pagos",
      label: "Pagos",
      icon: "CreditCard",
      path: "/payment-management",
      badge: alertData?.pagos || 0,
      roles: ["admin"],
      description: "Gestión de pagos",
    },
    {
      id: "access-control",
      label: "Modo Kiosco",
      icon: "Monitor",
      path: "/access-control",
      badge: 0,
      roles: ["admin"],
      description: "Control de acceso",
      openInNewTab: true,
    },
    {
      id: "history-access",
      label: "Historial Accesos",
      icon: "ClipboardList",
      path: "/access-history",
      badge: 0,
      roles: ["admin"],
      description: "Registro de accesos",
    },
    {
      id: "horarios",
      label: "Planificación",
      icon: "Calendar",
      path: "/class-schedule",
      badge: 0,
      roles: ["admin", "profesor"],
      description: "Calendario de clases",
    },
  ];

  const menuItems = allMenuItems.filter((item) => {
    const role = currentUser?.role;

    if (role === "profesor") {
      return item.id === "horarios";
    }

    if (role === "atleta") {
      return item.id === "athlete-portal";
    }

    return item?.roles?.includes(role);
  });

  const isActive = (path) => {
    return (
      location?.pathname === path || location?.pathname?.startsWith(path + "/")
    );
  };

  const handleMobileToggle = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileOpen(false);
  };

  const getUserInitials = (name) => {
    if (!name) return "US";
    const names = name.trim().split(" ");
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  };

  const getRoleLabel = (role) => {
    const roleLabels = {
      admin: "Administrador",
      profesor: "Profesor",
      atleta: "Atleta",
    };
    return roleLabels[role] || role;
  };

  return (
    <>
      {/* Botón Mobile */}
      <button
        onClick={handleMobileToggle}
        className="fixed top-4 left-4 z-40 lg:hidden bg-card p-3 rounded-lg shadow-lg transition-smooth hover:bg-muted border border-border"
        aria-label="Toggle navigation menu"
      >
        <Icon
          name={isMobileOpen ? "X" : "Menu"}
          size={24}
          color="var(--color-foreground)"
        />
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-card border-r border-border
          transition-all duration-300 ease-in-out z-30
          flex flex-col
          ${isCollapsed ? "w-20" : "w-60"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
{/* Header — reemplaza el div completo del header */}
<div className={`flex items-center h-16 px-3 border-b border-border flex-shrink-0 ${
  isCollapsed ? 'justify-center' : 'justify-between'
}`}>

  {/* Logo — se oculta al colapsar */}
  {!isCollapsed && (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon name="Dumbbell" size={22} color="#FFFFFF" />
      </div>
      <span className="text-lg font-heading font-bold text-foreground whitespace-nowrap">
        VC Fit
      </span>
    </div>
  )}

  {/* Ícono solo cuando colapsado */}
  {isCollapsed && (
    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
      <Icon name="Dumbbell" size={22} color="#FFFFFF" />
    </div>
  )}

  {/* Botón colapsar — siempre visible en desktop */}
  <button
    onClick={onToggleCollapse}
    className={`hidden lg:flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-white hover:bg-muted transition-all flex-shrink-0 ${
      isCollapsed ? 'absolute top-4 -right-4 shadow-sm' : ''
    }`}
    aria-label={isCollapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
    title={isCollapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
  >
    <Icon
      name={isCollapsed ? 'PanelLeftOpen' : 'PanelLeftClose'}
      size={16}
      color="var(--color-foreground)"
    />
  </button>
</div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {menuItems?.map((item) => (
            <Link
              key={item?.id}
              to={item?.path}
              onClick={(e) => {
                if (item?.openInNewTab) {
                  e.preventDefault();
                  window.open(item.path, "_blank", "noopener,noreferrer");
                } else {
                  closeMobileMenu();
                }
              }}
              target={item?.openInNewTab ? "_blank" : undefined}
              rel={item?.openInNewTab ? "noopener noreferrer" : undefined}
              className={`
                relative flex items-center h-11 px-3 rounded-lg
                transition-all duration-200 group
                ${
                  isActive(item?.path)
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-foreground hover:bg-muted hover:text-primary"
                }
                ${isCollapsed ? "justify-center" : "justify-start"}
              `}
              title={isCollapsed ? item?.label : ""}
            >
              <div className="flex-shrink-0">
                <Icon
                  name={item?.icon}
                  size={20}
                  color={
                    isActive(item?.path)
                      ? "var(--color-primary)"
                      : "currentColor"
                  }
                />
              </div>

              {/* Reemplaza el bloque del label en el nav (línea ~el span del label) */}
              {!isCollapsed && (
                <>
                  <span className="ml-3 font-medium text-sm truncate transition-opacity duration-200 opacity-100">
                    {item?.label}
                  </span>
                  {item?.badge > 0 && (
                    <AlertBadge
                      count={item?.badge}
                      severity={item?.id === "pagos" ? "critical" : "warning"}
                      position="right"
                    />
                  )}
                </>
              )}

              {isCollapsed && item?.badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-error text-white text-[10px] font-bold rounded-full px-1">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Usuario */}
{/* Footer usuario — reemplaza el div completo del footer */}
<div className="border-t border-border flex-shrink-0">

  {/* EXPANDIDO */}
  {!isCollapsed && (
    <div className="flex items-center gap-3 p-3">
      <div className="relative flex-shrink-0">
        {currentUser?.avatar_url ? (
          <img
            src={currentUser.avatar_url}
            alt={currentUser?.name || 'Usuario'}
            className="w-9 h-9 rounded-full object-cover border-2 border-primary/20"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center border-2 border-primary/30">
            <span className="text-sm font-bold text-primary">
              {getUserInitials(currentUser?.name)}
            </span>
          </div>
        )}
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success border-2 border-card rounded-full" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate leading-tight">
          {currentUser?.name || 'Usuario'}
        </p>
        <span className={`
          inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
          ${currentUser?.role === 'admin' ? 'bg-primary/15 text-primary' : ''}
          ${currentUser?.role === 'profesor' ? 'bg-accent/15 text-accent' : ''}
          ${currentUser?.role === 'atleta' ? 'bg-success/15 text-success' : ''}
        `}>
          {getRoleLabel(currentUser?.role)}
        </span>
      </div>

      <button
        onClick={logout}
        className="p-2 hover:bg-error/10 hover:text-error rounded-lg transition-all duration-200 flex-shrink-0"
        title="Cerrar sesión"
      >
        <Icon name="LogOut" size={17} color="currentColor" />
      </button>
    </div>
  )}

  {/* COLAPSADO */}
  {isCollapsed && (
    <div className="flex flex-col items-center py-3 gap-2">
      {/* Avatar */}
      <div className="relative">
        {currentUser?.avatar_url ? (
          <img
            src={currentUser.avatar_url}
            alt={currentUser?.name || 'Usuario'}
            className="w-9 h-9 rounded-full object-cover border-2 border-primary/20"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center border-2 border-primary/30">
            <span className="text-sm font-bold text-primary">
              {getUserInitials(currentUser?.name)}
            </span>
          </div>
        )}
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success border-2 border-card rounded-full" />
      </div>

      {/* Rol abreviado */}
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
        {currentUser?.role?.substring(0, 3)}
      </span>

      {/* Logout */}
      <button
        onClick={logout}
        className="p-2 hover:bg-error/10 hover:text-error rounded-lg transition-all duration-200"
        title="Cerrar sesión"
      >
        <Icon name="LogOut" size={17} color="currentColor" />
      </button>
    </div>
  )}
</div>
      </aside>

      {/* Overlay Mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-20 lg:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default NavigationSidebar;
