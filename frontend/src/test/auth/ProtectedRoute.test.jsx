/**
 * TDD — ProtectedRoute guard tests
 *
 * Tests the ProtectedRoute component in isolation using createRoutesStub
 * so we verify redirect behaviour without a real router instance.
 *
 * Red phase: tests are written BEFORE the implementation exists.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';

// ── Mock useAuth so tests control the auth state ──────────────────────────────
vi.mock('../../auth/useAuth', () => ({
  default: vi.fn(),
}));

import useAuth from '../../auth/useAuth';
import ProtectedRoute from '../../auth/ProtectedRoute';

// Helper: build a minimal stub router that mounts ProtectedRoute at "/"
// and a sentinel page at "/login" and "/dashboard" so redirects can be asserted.
function makeStub(user, allowedRoles) {
  return createRoutesStub([
    {
      path: '/',
      Component: () => (
        <ProtectedRoute allowedRoles={allowedRoles}>
          <div data-testid="protected-content">Secret Page</div>
        </ProtectedRoute>
      ),
    },
    {
      path: '/login',
      Component: () => <div data-testid="login-page">Login</div>,
    },
    {
      path: '/dashboard',
      Component: () => <div data-testid="dashboard-page">Dashboard</div>,
    },
  ]);
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login when user is not authenticated', () => {
    // ARRANGE — simulate no logged-in user
    useAuth.mockReturnValue({ user: null });
    const Stub = makeStub(null, undefined);

    // ACT
    render(<Stub initialEntries={['/']} />);

    // ASSERT — user should land on the login page
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated and no role restriction', () => {
    // ARRANGE — simulate a logged-in employee
    useAuth.mockReturnValue({ user: { roles: ['Employee'] } });
    const Stub = makeStub({ roles: ['Employee'] }, undefined);

    // ACT
    render(<Stub initialEntries={['/']} />);

    // ASSERT — protected content is visible
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('redirects to /dashboard when user lacks required role', () => {
    // ARRANGE — employee trying to access a NON_EMPLOYEE_ROLES route
    useAuth.mockReturnValue({ user: { roles: ['Employee'] } });
    const allowedRoles = ['Admin', 'HR', 'Vertical Lead', 'Manager'];
    const Stub = makeStub({ roles: ['Employee'] }, allowedRoles);

    // ACT
    render(<Stub initialEntries={['/']} />);

    // ASSERT — redirected to dashboard, not shown the protected page
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders children when user has a matching allowed role', () => {
    // ARRANGE — Admin trying to access an admin-only route
    useAuth.mockReturnValue({ user: { roles: ['Admin'] } });
    const allowedRoles = ['Admin', 'HR', 'Vertical Lead', 'Manager'];
    const Stub = makeStub({ roles: ['Admin'] }, allowedRoles);

    // ACT
    render(<Stub initialEntries={['/']} />);

    // ASSERT — admin sees the content
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
