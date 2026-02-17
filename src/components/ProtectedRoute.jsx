import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, currentUser, isLoading } = useAuth();

  // Loader genérico con tus tokens de diseño
  const Loader = ({ text }) => (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">{text}</p>
      </div>
    </div>
  );

  // 1. Cargando inicial
  if (isLoading) {
    return <Loader text="Cargando..." />;
  }

  // 2. No autenticado -> Login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 3. Autenticado pero SIN perfil (Caso "Limbo")
  if (!currentUser) {
    return <Loader text="Cargando perfil..." />;
  }

  // 4. Verificación de Rol
  if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;