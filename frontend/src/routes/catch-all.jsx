/**
 * catch-all.jsx — Wildcard catch-all route
 * Redirects any unmatched path to "/dashboard".
 */
import { Navigate } from 'react-router';
import ROUTES from '../config/routes';

export default function CatchAll() {
  return <Navigate to={ROUTES.DASHBOARD} replace />;
}
