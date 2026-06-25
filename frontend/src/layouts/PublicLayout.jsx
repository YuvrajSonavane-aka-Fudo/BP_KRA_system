import React from 'react';
import { Outlet } from 'react-router';
import AuthLayout from './AuthLayout';

export default function PublicLayout() {
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}
