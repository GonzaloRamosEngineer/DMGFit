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

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ScrollToTop />
        <RouterRoutes>
          <Route
            path="/login-role-selection"
            element={<LoginRoleSelection />}
          />
          <Route
            path="/"
            element={<Navigate to="/login-role-selection" replace />}
          />

          <Route path="/access-control" element={<AccessControl />} />

          <Route path="/access-history" element={<AccessHistory />} />

          <Route
            path="/class-schedule"
            element={
              <ProtectedRoute allowedRoles={["admin", "profesor"]}>
                <ClassSchedule />
              </ProtectedRoute>
            }
          />

          <Route
            path="/main-dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin", "profesor"]}>
                <MainDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/professor-dashboard"
            element={
              <ProtectedRoute allowedRoles={["profesor"]}>
                <ProfessorDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/athlete-portal"
            element={
              <ProtectedRoute allowedRoles={["atleta"]}>
                <AthletePortal />
              </ProtectedRoute>
            }
          />

          <Route
            path="/athletes-management"
            element={
              <ProtectedRoute allowedRoles={["admin", "profesor"]}>
                <AthletesManagement />
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

          <Route
            path="/coaches-management"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <CoachesManagement />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
