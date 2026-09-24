import { Navigate, Route, Routes } from 'react-router-dom';
import { type ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { TransfersPage } from './pages/TransfersPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { AuditPage } from './pages/AuditPage';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="login-page">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { canPurchaseOrTransfer, canAssignOrExpend, isAdmin, user } = useAuth();
  const canViewAudit = isAdmin || user?.role === 'BASE_COMMANDER';

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route
        path="/forgot-password"
        element={<Navigate to="/change-password" replace />}
      />
      <Route
        path="/reset-password"
        element={<Navigate to="/change-password" replace />}
      />
      <Route
        path="/app"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route
          path="purchases"
          element={
            canPurchaseOrTransfer ? (
              <PurchasesPage />
            ) : (
              <Navigate to="/app" replace />
            )
          }
        />
        <Route
          path="transfers"
          element={
            canPurchaseOrTransfer ? (
              <TransfersPage />
            ) : (
              <Navigate to="/app" replace />
            )
          }
        />
        <Route
          path="assignments"
          element={
            canAssignOrExpend ? (
              <AssignmentsPage />
            ) : (
              <Navigate to="/app" replace />
            )
          }
        />
        <Route
          path="audit"
          element={
            canViewAudit ? <AuditPage /> : <Navigate to="/app" replace />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
