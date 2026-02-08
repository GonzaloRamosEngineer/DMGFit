import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import NavigationSidebar from './components/ui/NavigationSidebar';
import { useAuth } from './contexts/AuthContext';

const AppLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { currentUser } = useAuth();

  // Ejemplo de datos de alertas - ajustar según tu lógica
  const alertData = {
    dashboard: 0,
    atletas: 0,
    rendimiento: 0,
    pagos: 0
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - Solo se renderiza una vez */}
      <NavigationSidebar 
        isCollapsed={isSidebarCollapsed} 
        alertData={alertData}
      />
      
      {/* Main Content Area - Ajustado con padding superior en mobile para evitar solapamiento */}
      <main className={`flex-1 min-w-0 overflow-x-hidden transition-all duration-300 pt-20 lg:pt-0 ${
        isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-60'
      }`}>
        {/* Toggle button para desktop */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden lg:flex fixed top-6 right-6 z-30 p-2.5 bg-white rounded-xl shadow-md border border-border hover:shadow-lg transition-all duration-300 items-center justify-center group"
          aria-label="Toggle sidebar"
          title={isSidebarCollapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
        >
          <svg 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-300 text-muted-foreground group-hover:text-primary ${
              isSidebarCollapsed ? 'rotate-180' : ''
            }`}
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Content Container */}
        <div className="w-full h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;