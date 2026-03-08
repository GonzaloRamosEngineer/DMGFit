import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import NavigationSidebar from './components/ui/NavigationSidebar';

const AppLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const alertData = {
    dashboard: 0,
    atletas: 0,
    rendimiento: 0,
    pagos: 0
  };

  return (
    <div className="flex min-h-screen bg-background">
      <NavigationSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        alertData={alertData}
      />

      <main
        className={`min-w-0 overflow-x-hidden transition-all duration-300 pt-20 lg:pt-0 ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-60'
        }`}
      >
        <div className="w-full h-full bg-[#F8FAFC] px-3 sm:px-4 md:px-5 lg:px-5 xl:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
