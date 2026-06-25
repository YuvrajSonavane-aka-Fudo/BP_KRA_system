/**
 * TDD — Routing redirect tests
 *
 * Verifies the catch-all route (src/routes/catch-all.jsx) and home route
 * (src/routes/home.jsx) redirect to /dashboard correctly.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';

// We don't need auth for redirect tests
vi.mock('../../auth/useAuth', () => ({
  default: vi.fn(() => ({ user: null })),
}));

describe('Root redirect (/ → /dashboard)', () => {
  it('navigating to / renders the dashboard sentinel', async () => {
    const { default: HomeRoute } = await import('../../routes/home.jsx');

    const Stub = createRoutesStub([
      { index: true, Component: HomeRoute },
      {
        path: '/dashboard',
        Component: () => <div data-testid="dashboard">Dashboard</div>,
      },
    ]);

    render(<Stub initialEntries={['/']} />);
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });
});

describe('Catch-all route (* → /dashboard)', () => {
  it('navigating to an unknown path renders the dashboard sentinel', async () => {
    const { default: CatchAll } = await import('../../routes/catch-all.jsx');

    const Stub = createRoutesStub([
      { path: '*', Component: CatchAll },
      {
        path: '/dashboard',
        Component: () => <div data-testid="dashboard">Dashboard</div>,
      },
    ]);

    render(<Stub initialEntries={['/completely/unknown/path']} />);
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });
});
