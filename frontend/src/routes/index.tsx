import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { AppShell } from '../components/layout/app-shell';
import { EmptyState, PageHeader } from '../components/shared/states';
import { Card } from '../components/ui/primitives';
import { LoginPage } from '../features/auth/LoginPage';
import { SignupPage } from '../features/auth/SignupPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';

function Placeholder({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon={Construction}
          title="Screen under construction"
          description="The layout shell is in place; this screen goes live once its API endpoints are wired up."
        />
      </Card>
    </>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route element={<AppShell />}>
          <Route index element={<Placeholder title="Dashboard" />} />
          <Route path="assets" element={<Placeholder title="Asset Directory" />} />
          <Route path="allocations" element={<Placeholder title="Allocation & Transfers" />} />
          <Route path="bookings" element={<Placeholder title="Resource Booking" />} />
          <Route path="maintenance" element={<Placeholder title="Maintenance" />} />
          <Route path="audits" element={<Placeholder title="Asset Audits" />} />
          <Route path="reports" element={<Placeholder title="Reports & Analytics" />} />
          <Route path="activity" element={<Placeholder title="Activity & Notifications" />} />
          <Route path="organization" element={<Placeholder title="Organization Setup" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
