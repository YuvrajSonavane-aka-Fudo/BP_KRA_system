/**
 * routes.js — React Router Framework Mode explicit route configuration.
 *
 * Uses the @react-router/dev/routes helpers to define the full route tree:
 *   - layout()  : a pathless layout route that wraps child routes
 *   - route()   : a path-bound route
 *   - index()   : an index route for the current layout segment
 *
 * All route module files live in src/routes/.
 * Paths map 1-to-1 with the existing ROUTES constants in src/config/routes.js.
 */
import { layout, route, index } from '@react-router/dev/routes';

export default [
  // ── Root index: / → redirect to /dashboard ────────────────────────────────
  index('routes/home.jsx'),

  // ── Public routes — wrapped in AuthLayout, no auth required ───────────────
  layout('routes/public-layout.jsx', [
    route('/login',              'routes/login.jsx'),
    route('/auth/sso/callback',  'routes/sso-callback.jsx'),
  ]),

  // ── Protected routes — requires authentication + MainLayout sidebar ────────
  layout('routes/protected-layout.jsx', [
    route('/dashboard',          'routes/dashboard.jsx'),
    route('/cycles/:id',         'routes/cycle-detail.jsx'),
    route('/assessments/self',   'routes/self-assessment.jsx'),

    // Role-restricted: NON_EMPLOYEE_ROLES only (['Admin','HR','Vertical Lead','Manager'])
    layout('routes/role-layout.jsx', [
      route('/cycles',             'routes/cycles-list.jsx'),
      route('/kra-library',        'routes/kra-library.jsx'),
      route('/assignments',        'routes/bulk-assignment.jsx'),
      route('/assessments/team',   'routes/team-performance.jsx'),
      route('/reports',            'routes/reports.jsx'),
    ]),
  ]),

  // ── Catch-all: any unknown path → redirect to /dashboard ──────────────────
  route('*', 'routes/catch-all.jsx'),
];
