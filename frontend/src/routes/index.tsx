import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppShell } from '../components/layout/app-shell';
import { useAuth, usePermissions } from '../lib/auth';
import { LoginPage } from '../features/auth/LoginPage';
import { SignupPage } from '../features/auth/SignupPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { OrganizationPage } from '../features/organization/OrganizationPage';
import { AssetsPage } from '../features/assets/AssetsPage';
import { AssetDetailPage } from '../features/assets/AssetDetailPage';
import { AllocationsPage } from '../features/allocations/AllocationsPage';
import { BookingsPage } from '../features/bookings/BookingsPage';
import { MaintenancePage } from '../features/maintenance/MaintenancePage';
import { AuditsPage } from '../features/audits/AuditsPage';
import { AuditCycleDetailPage } from '../features/audits/AuditCycleDetailPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { ActivityPage } from '../features/activity/ActivityPage';

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = usePermissions();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
        <Route path="/reset-password" element={<PublicOnly><ResetPasswordPage /></PublicOnly>} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="assets/:id" element={<AssetDetailPage />} />
          <Route path="allocations" element={<AllocationsPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="audits" element={<AuditsPage />} />
          <Route path="audits/:id" element={<AuditCycleDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="organization" element={<RequireAdmin><OrganizationPage /></RequireAdmin>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
