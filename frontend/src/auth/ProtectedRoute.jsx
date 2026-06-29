import React from 'react';
import { Navigate } from 'react-router';
import useAuth from './useAuth';
import ROUTES from '../config/routes';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (allowedRoles && !allowedRoles.some((r) => user.roles?.includes(r))) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return children;
}
