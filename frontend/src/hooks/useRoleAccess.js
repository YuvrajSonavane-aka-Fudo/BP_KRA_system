import useAuth from '../auth/useAuth';

const ROLE = {
  ADMIN:          'Admin',
  HR:             'HR',
  VERTICAL_LEAD:  'Vertical Lead',
  TEAM_LEAD:      'Manager',   // backend uses "Manager" for reporting manager / team lead
  EMPLOYEE:       'Employee',
};

/**
 * useRoleAccess — exposes boolean flags for the current user's roles.
 *
 * Usage:
 *   const { isHR, isLead, canManageCycles } = useRoleAccess();
 */
export default function useRoleAccess() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];

  const hasRole = (...names) => names.some((n) => roles.includes(n));

  const isAdmin         = hasRole(ROLE.ADMIN);
  const isHR            = hasRole(ROLE.HR, ROLE.ADMIN);
  const isVerticalLead  = hasRole(ROLE.VERTICAL_LEAD);
  const isTeamLead      = hasRole(ROLE.TEAM_LEAD);
  const isEmployee      = hasRole(ROLE.EMPLOYEE);

  // Composite permissions
  const canManageCycles    = isHR;                              // create / activate / clone
  const canAssignKRAs      = isHR || isVerticalLead;           // bulk assignment stage
  const canAddProjectKRAs  = isTeamLead;                       // KRA assignment by lead stage
  const canViewAllEmployees = isHR || isVerticalLead;
  const canLeadAssess      = isTeamLead || isVerticalLead || isHR;

  return {
    roles,
    isAdmin,
    isHR,
    isVerticalLead,
    isTeamLead,
    isEmployee,
    canManageCycles,
    canAssignKRAs,
    canAddProjectKRAs,
    canViewAllEmployees,
    canLeadAssess,
  };
}
