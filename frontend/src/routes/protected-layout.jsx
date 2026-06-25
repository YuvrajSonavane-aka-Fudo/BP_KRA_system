/**
 * protected-layout.jsx — Authenticated route layout
 *
 * Guards all child routes behind ProtectedRoute (redirects to /login if
 * unauthenticated), then wraps the content with MainLayout (sidebar).
 * Child routes render through the Outlet.
 */
import { Outlet } from 'react-router';
import ProtectedRoute from '../auth/ProtectedRoute';
import MainLayout from '../layouts/MainLayout';

export default function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <Outlet />
      </MainLayout>
    </ProtectedRoute>
  );
}
