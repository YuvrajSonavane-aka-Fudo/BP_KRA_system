const ROUTES = {
  LOGIN: '/login',
  SSO_CALLBACK: '/auth/sso/callback',
  DASHBOARD: '/dashboard',
  CYCLES: '/cycles',
  CYCLE_CREATE: '/cycles/create',
  CYCLE_DETAIL: '/cycles/:id',
  CYCLE_CLONE: '/cycles/:id/clone',   // ← added
  KRA_LIBRARY: '/kra-library',
  ASSIGNMENTS: '/assignments',
  ASSESSMENTS_SELF: '/assessments/self',
  ASSESSMENTS_LEAD: '/assessments/lead',
  TEAM_PERFORMANCE: '/assessments/team',
  LEVELS: '/levels',
  REPORTS: '/reports',
};

export default ROUTES;