/**
 * home.jsx — Root index route
 * Redirects "/" immediately to "/dashboard".
 */
import { Navigate } from 'react-router';
import ROUTES from '../config/routes';

export default function Home() {
  return <Navigate to={ROUTES.DASHBOARD} replace />;
}
