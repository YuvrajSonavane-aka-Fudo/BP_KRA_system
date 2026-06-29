/**
 * TDD — Route layout composition tests
 *
 * Tests that the three layout route modules (_public, _protected, _role)
 * compose correctly — each renders its Outlet and applies the right guard.
 *
 * These tests run against the route module files under src/routes/.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';

// ── Mock useAuth ──────────────────────────────────────────────────────────────
vi.mock('../../auth/useAuth', () => ({
  default: vi.fn(),
}));

// ── Mock MUI-based layout wrappers ───────────────────────────────────────────
// Layout tests verify routing logic (guards, redirects, Outlet rendering).
// We mock the visual wrappers so we don't pull MUI's ESM into the jsdom env.
vi.mock('../../layouts/AuthLayout', () => ({
  default: ({ children }) => <div data-testid="auth-layout">{children}</div>,
}));

vi.mock('../../layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

import useAuth from '../../auth/useAuth';


// ── Lazy-import the route layout modules after mock is set up ─────────────────
// We import directly so we can test layout behaviour independently of route config.

describe('PublicLayout route module (_public.jsx)', () => {
  it('renders child page content inside AuthLayout', async () => {
    const { default: PublicLayout } = await import('../../routes/public-layout.jsx');

    const Stub = createRoutesStub([
      {
        path: '/',
        Component: PublicLayout,
        children: [
          {
            index: true,
            Component: () => <div data-testid="child-page">Login Page</div>,
          },
        ],
      },
    ]);

    render(<Stub initialEntries={['/']} />);
    expect(screen.getByTestId('child-page')).toBeInTheDocument();
  });
});

describe('ProtectedLayout route module (_protected.jsx)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects unauthenticated user to /login', async () => {
    useAuth.mockReturnValue({ user: null });
    const { default: ProtectedLayout } = await import('../../routes/protected-layout.jsx');

    const Stub = createRoutesStub([
      {
        path: '/',
        Component: ProtectedLayout,
        children: [
          {
            index: true,
            Component: () => <div data-testid="inner">Protected</div>,
          },
        ],
      },
      {
        path: '/login',
        Component: () => <div data-testid="login">Login Page</div>,
      },
    ]);

    render(<Stub initialEntries={['/']} />);
    expect(screen.getByTestId('login')).toBeInTheDocument();
    expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
  });

  it('renders Outlet when user is authenticated', async () => {
    useAuth.mockReturnValue({ user: { roles: ['Admin'] } });
    const { default: ProtectedLayout } = await import('../../routes/protected-layout.jsx');

    const Stub = createRoutesStub([
      {
        path: '/',
        Component: ProtectedLayout,
        children: [
          {
            index: true,
            Component: () => <div data-testid="inner">Dashboard</div>,
          },
        ],
      },
      { path: '/login', Component: () => <div>Login</div> },
    ]);

    render(<Stub initialEntries={['/']} />);
    expect(screen.getByTestId('inner')).toBeInTheDocument();
  });
});

describe('RoleLayout route module (_role.jsx)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects Employee to /dashboard when accessing role-restricted route', async () => {
    useAuth.mockReturnValue({ user: { roles: ['Employee'] } });
    const { default: RoleLayout } = await import('../../routes/role-layout.jsx');

    const Stub = createRoutesStub([
      {
        path: '/cycles',
        Component: RoleLayout,
        children: [
          {
            index: true,
            Component: () => <div data-testid="cycles">Cycles List</div>,
          },
        ],
      },
      {
        path: '/dashboard',
        Component: () => <div data-testid="dashboard">Dashboard</div>,
      },
      { path: '/login', Component: () => <div>Login</div> },
    ]);

    render(<Stub initialEntries={['/cycles']} />);
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('cycles')).not.toBeInTheDocument();
  });

  it('renders Outlet for Admin on role-restricted route', async () => {
    useAuth.mockReturnValue({ user: { roles: ['Admin'] } });
    const { default: RoleLayout } = await import('../../routes/role-layout.jsx');

    const Stub = createRoutesStub([
      {
        path: '/cycles',
        Component: RoleLayout,
        children: [
          {
            index: true,
            Component: () => <div data-testid="cycles">Cycles List</div>,
          },
        ],
      },
      { path: '/dashboard', Component: () => <div>Dashboard</div> },
      { path: '/login', Component: () => <div>Login</div> },
    ]);

    render(<Stub initialEntries={['/cycles']} />);
    expect(screen.getByTestId('cycles')).toBeInTheDocument();
  });
});
