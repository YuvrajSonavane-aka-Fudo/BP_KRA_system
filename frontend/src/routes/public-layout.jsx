/**
 * public-layout.jsx — Public route layout
 *
 * Wraps all public routes (login, SSO callback) inside AuthLayout.
 * No authentication check is applied here.
 */
import { Outlet } from 'react-router';
import AuthLayout from '../layouts/AuthLayout';

export default function PublicLayout() {
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}
