import React from 'react';
import { Outlet } from 'react-router';
import ProtectedRoute from '../auth/ProtectedRoute';
import MainLayout from './MainLayout';

export default function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <Outlet />
      </MainLayout>
    </ProtectedRoute>
  );
}
