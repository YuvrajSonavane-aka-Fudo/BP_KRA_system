import React from 'react';
import { Outlet } from 'react-router';
import ProtectedRoute from '../auth/ProtectedRoute';

export default function RoleGuardLayout({ allowedRoles }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <Outlet />
    </ProtectedRoute>
  );
}
