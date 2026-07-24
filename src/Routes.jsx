import React, { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Routes as RouterRoutes,
  Route,
  Navigate,
} from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./AppLayout";
// Login eager: es el punto de entrada, queremos primer paint inmediato.
import LoginRoleSelection from "./pages/login-role-selection";

// Resto de páginas con code-splitting (un chunk por página, carga on-demand).
const NotFound = lazy(() => import("pages/NotFound"));
const IndividualAthleteProfile = lazy(() => import("./pages/individual-athlete-profile"));
const MainDashboard = lazy(() => import("./pages/main-dashboard"));
const AthletesManagement = lazy(() => import("./pages/athletes-management"));
const PaymentManagement = lazy(() => import("./pages/payment-management"));
const PlanManagement = lazy(() => import("./pages/plan-management"));
const ProfessorDashboard = lazy(() => import("./pages/professor-dashboard"));
const AthletePortal = lazy(() => import("./pages/athlete-portal"));
const CoachesManagement = lazy(() => import("./pages/coaches-management"));
const AccessControl = lazy(() => import("./pages/access-control"));
const AccessHistory = lazy(() => import("./pages/access-history"));
const CoachAttendance = lazy(() => import("./pages/coach-attendance"));
const ClassSchedule = lazy(() => import("./pages/class-schedule"));
const ExerciseLibrary = lazy(() => import("./pages/exercise-library"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const UpdatePassword = lazy(() => import("./pages/auth/UpdatePassword"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh] w-full">
    <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
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
              <ProtectedRoute allowedRoles={["admin", "kiosko"]}>
                <AccessControl />
              </ProtectedRoute>
            }
          />

          {/* --- Rutas Protegidas --- */}
          <Route element={<AppLayout />}>
            
            {/* Solo Admin */}
            <Route
              path="/main-dashboard"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
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
                <ProtectedRoute allowedRoles={["admin"]}>
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
              path="/exercise-library"
              element={
                <ProtectedRoute allowedRoles={["admin", "profesor"]}>
                  <ExerciseLibrary />
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

            {/* Panel del profesor (su agenda de turnos) */}
            <Route
              path="/professor-dashboard"
              element={
                <ProtectedRoute allowedRoles={["admin", "profesor"]}>
                  <ProfessorDashboard />
                </ProtectedRoute>
              }
            />

            {/* Reporte de asistencia de profesores (admin) */}
            <Route
              path="/coach-attendance"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <CoachAttendance />
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
            <Route
              path="/athlete-portal/:section"
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
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
