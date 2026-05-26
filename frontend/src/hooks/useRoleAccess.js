import useAuth from '../auth/useAuth'; 
const ROLE = {
  ADMIN:     'Admin',
  MANAGER:   'Manager',
  EMPLOYEE:  'Employee',
};

export default function useRoleAccess() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];

  const hasRole = (...names) => names.some((n) => roles.includes(n));

  const isAdmin    = hasRole(ROLE.ADMIN);
  const isManager  = hasRole(ROLE.MANAGER);
  const isEmployee = hasRole(ROLE.EMPLOYEE);

  const canManageCycles   = isAdmin;
  const canAssignKRAs     = isAdmin || isManager;
  const canManageOrg      = isAdmin;          // only Admin touches Org-level
  const canManage         = isAdmin || isManager;
  const canLeadAssess     = isAdmin || isManager;
  const canViewAllEmployees = isAdmin || isManager;

  return {
    roles,
    isAdmin,
    isManager,
    isEmployee,
    canManage,
    canManageOrg,
    canManageCycles,
    canAssignKRAs,
    canLeadAssess,
    canViewAllEmployees,
  };
}