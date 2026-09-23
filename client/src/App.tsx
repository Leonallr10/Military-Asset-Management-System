import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { TransfersPage } from './pages/TransfersPage';
import { AssignmentsPage } from './pages/AssignmentsPage';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="login-page">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { canPurchaseOrTransfer, canAssignOrExpend } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
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
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="transfers"
          element={
            canPurchaseOrTransfer ? (
              <TransfersPage />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="assignments"
          element={
            canAssignOrExpend ? (
              <AssignmentsPage />
            ) : (
              <Navigate to="/" replace />
            )
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
