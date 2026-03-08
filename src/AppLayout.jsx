import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import NavigationSidebar from './components/ui/NavigationSidebar';

const AppLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const alertData = {
    dashboard: 0,
    atletas: 0,
    rendimiento: 0,
    pagos: 0,
  };

  return (
    <div className="flex min-h-screen bg-background">
      <NavigationSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        alertData={alertData}
      />

      <div
        className={`hidden lg:block shrink-0 ${
          isSidebarCollapsed ? 'w-20' : 'w-60'
        }`}
        aria-hidden="true"
      />

      <main className="flex-1 min-w-0 overflow-x-hidden pt-20 lg:pt-0">
        <div className="min-h-screen bg-[#F8FAFC] px-0 sm:px-1 lg:px-2 py-6 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;