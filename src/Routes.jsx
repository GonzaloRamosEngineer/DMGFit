import React from "react";
import {
  BrowserRouter,
  Routes as RouterRoutes,
  Route,
  Navigate,
} from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import ProtectedRoute from "components/ProtectedRoute";
import AppLayout from "./AppLayout";
import NotFound from "pages/NotFound";
import LoginRoleSelection from "./pages/login-role-selection";
import IndividualAthleteProfile from "./pages/individual-athlete-profile";
import MainDashboard from "./pages/main-dashboard";
import AthletesManagement from "./pages/athletes-management";
import PerformanceAnalytics from "./pages/performance-analytics";
import PaymentManagement from "./pages/payment-management";
import PlanManagement from "./pages/plan-management";
import ProfessorDashboard from "./pages/professor-dashboard";
import AthletePortal from "./pages/athlete-portal";
import PDFExportCenter from "./pages/pdf-export-center";
import CoachesManagement from "./pages/coaches-management";
import AccessControl from "./pages/access-control";
import AccessHistory from "./pages/access-history";
import ClassSchedule from "./pages/class-schedule";
import Unauthorized from "./pages/Unauthorized";

// Rutas de Auth
import ForgotPassword from "./pages/auth/ForgotPassword";
import UpdatePassword from "./pages/auth/UpdatePassword";

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ScrollToTop />
        <RouterRoutes>
          
          {/* --- Rutas Públicas --- */}
          <Route path="/login" element={<LoginRoleSelection />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />

          {/* --- Modo Kiosco --- */}
          <Route
            path="/access-control"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AccessControl />
              </ProtectedRoute>
            }
          />

          {/* --- Rutas Protegidas --- */}
          <Route element={<AppLayout />}>
            
            {/* Admin & Profesor Routes */}
            <Route
              path="/main-dashboard"
              element={
                <ProtectedRoute allowedRoles={["admin", "profesor"]}>
                  <MainDashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Solo Admin */}
            <Route
              path="/coaches-management"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <CoachesManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/plan-management"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <PlanManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment-management"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <PaymentManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/access-history"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AccessHistory />
                </ProtectedRoute>
              }
            />

            {/* Compartidas Admin/Profesor */}
            <Route
              path="/athletes-management"
              element={
                <ProtectedRoute allowedRoles={["admin", "profesor"]}>
                  <AthletesManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/class-schedule"
              element={
                <ProtectedRoute allowedRoles={["admin", "profesor"]}>
                  <ClassSchedule />
                </ProtectedRoute>
              }
            />
            <Route
              path="/performance-analytics"
              element={
                <ProtectedRoute allowedRoles={["admin", "profesor"]}>
                  <PerformanceAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/individual-athlete-profile/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "profesor"]}>
                  <IndividualAthleteProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pdf-export-center"
              element={
                <ProtectedRoute allowedRoles={["admin", "profesor"]}>
                  <PDFExportCenter />
                </ProtectedRoute>
              }
            />

            {/* Solo Profesor */}
            <Route
              path="/professor-dashboard"
              element={
                <ProtectedRoute allowedRoles={["profesor"]}>
                  <ProfessorDashboard />
                </ProtectedRoute>
              }
            />

            {/* Solo Atleta */}
            <Route
              path="/athlete-portal"
              element={
                <ProtectedRoute allowedRoles={["atleta"]}>
                  <AthletePortal />
                </ProtectedRoute>
              }
            />
            
            <Route path="/unauthorized" element={<Unauthorized />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;