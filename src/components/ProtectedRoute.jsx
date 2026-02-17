import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, currentUser, isLoading, logout } = useAuth();

  const Loader = ({ text, showLogout = false }) => (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground mb-4">{text}</p>

        {showLogout && typeof logout === 'function' && (
          <button
            onClick={logout}
            className="text-xs text-primary hover:underline font-medium"
          >
            ¿Tarda mucho? Volver al login
          </button>
        )}
      </div>
    </div>
  );

  // 1. Cargando inicial (Auth check)
  if (isLoading) return <Loader text="Cargando..." />;

  // 2. No autenticado -> Login
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // 3. Autenticado pero SIN perfil (Caso "Limbo" - Relaxed Mode)
  // Aquí mostramos el botón de escape por si la red falla y el perfil no llega.
  if (!currentUser) return <Loader text="Cargando perfil..." showLogout />;

  // 4. Verificación de Rol
  if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;