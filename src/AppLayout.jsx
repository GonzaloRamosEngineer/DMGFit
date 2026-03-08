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
        className={`flex-1 min-w-0 overflow-x-hidden transition-all duration-300 pt-20 lg:pt-0 ${
          isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-60'
        }`}
      >
        <div className="w-full h-full bg-[#F8FAFC] px-2 sm:px-3 md:px-4 lg:px-4 xl:px-5">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
