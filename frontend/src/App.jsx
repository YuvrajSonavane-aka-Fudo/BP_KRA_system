import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

import AuthProvider    from './auth/AuthProvider';
import ProtectedRoute  from './auth/ProtectedRoute';
import AuthLayout      from './layouts/AuthLayout';
import MainLayout      from './layouts/MainLayout';

import LoginPage         from './auth/pages/LoginPage';
import SSOCallbackPage   from './auth/pages/SSOCallbackPage';

import DashboardPage        from './pages/dashboard/DashboardPage';
import CyclesListPage       from './pages/cycles/CyclesListPage';
import CycleDetailPage      from './pages/cycles/CycleDetailPage';
import KRALibraryPage       from './pages/kra_library/KRALibraryPage';
import BulkAssignmentPage   from './pages/assignments/BulkAssignmentPage';

// ── New assessment pages ──────────────────────────────────────────────────────
import SelfAssessmentPage   from './pages/assessments/SelfAssessmentPage';
import TeamPerformancePage  from './pages/assessments/TeamPerformancePage';

import ROUTES from './config/routes';
import './assets/styles/global.css';

const theme = createTheme({
  palette: {
    primary:    { main: '#1E3A8A' },
    secondary:  { main: '#2d4fd6' },
    background: { default: '#f5f6fa', paper: '#ffffff' },
  },
  typography: { fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif' },
  shape: { borderRadius: 10 },
  components: {
    MuiButton:  { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 } } },
    MuiPaper:   { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path={ROUTES.LOGIN}        element={<AuthLayout><LoginPage /></AuthLayout>} />
      <Route path={ROUTES.SSO_CALLBACK} element={<AuthLayout><SSOCallbackPage /></AuthLayout>} />

      {/* Protected */}
      <Route path={ROUTES.DASHBOARD}    element={<Protected><DashboardPage /></Protected>} />
      <Route path={ROUTES.CYCLE_DETAIL} element={<Protected><CycleDetailPage /></Protected>} />
      <Route path={ROUTES.CYCLES}       element={<Protected><CyclesListPage /></Protected>} />
      <Route path={ROUTES.KRA_LIBRARY}  element={<Protected><KRALibraryPage /></Protected>} />
      <Route path={ROUTES.ASSIGNMENTS}  element={<Protected><BulkAssignmentPage /></Protected>} />

      {/* Assessment pages */}
      <Route path={ROUTES.ASSESSMENTS_SELF} element={<Protected><SelfAssessmentPage /></Protected>} />
      <Route path={ROUTES.TEAM_PERFORMANCE} element={<Protected><TeamPerformancePage /></Protected>} />

      {/* Catch-all */}
      <Route path="/"  element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path="*"  element={<Navigate to={ROUTES.DASHBOARD} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}