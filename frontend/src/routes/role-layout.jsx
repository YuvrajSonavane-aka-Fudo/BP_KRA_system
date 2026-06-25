/**
 * role-layout.jsx — Role-based guard layout
 *
 * Sits INSIDE protected-layout. Restricts access to NON_EMPLOYEE_ROLES.
 * Employees are redirected to /dashboard; managers/admins/HR pass through.
 */
import { Outlet } from 'react-router';
import ProtectedRoute from '../auth/ProtectedRoute';

// Routes under this layout are only accessible to non-employee roles.
const NON_EMPLOYEE_ROLES = ['Admin', 'HR', 'Vertical Lead', 'Manager'];

export default function RoleLayout() {
  return (
    <ProtectedRoute allowedRoles={NON_EMPLOYEE_ROLES}>
      <Outlet />
    </ProtectedRoute>
  );
}
