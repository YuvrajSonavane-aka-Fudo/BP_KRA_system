/**
 * TDD Tests: SSO Token Auto-Login for KRA AuthProvider
 *
 * These tests define the expected behaviour BEFORE implementation.
 * Run: npx vitest run src/test/AuthProvider.sso.test.jsx
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import AuthProvider, { AuthContext } from '../auth/AuthProvider';
import ssoService from '../auth/services/ssoService';
import tokenService from '../auth/services/tokenService';
import authApi from '../api/authApi';

vi.mock('../auth/services/ssoService', () => ({
  default: {
    exchangeMicrosoftToken: vi.fn(),
    redirectToProvider: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('../auth/services/tokenService', () => ({
  default: {
    hasToken: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
    getAccessToken: vi.fn(),
  },
}));

vi.mock('../api/authApi', () => ({
  default: {
    me: vi.fn(),
  },
}));

function getUser(container) {
  // Helper consumer — reads user out of context
  let captured = null;
  function Consumer() {
    captured = React.useContext(AuthContext)?.user;
    return null;
  }
  render(<AuthProvider><Consumer /></AuthProvider>, { container });
  return () => captured;
}

describe('AuthProvider – SSO token auto-login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    vi.mocked(tokenService.hasToken).mockReturnValue(false);
  });

  it('should call exchangeMicrosoftToken when ?sso_token= is in the URL', async () => {
    // ARRANGE
    const mockSSOData = {
      session_id: 'sess_abc',
      employee_id: 42,
      roles: ['HR'],
      full_name: 'Jane Doe',
      department: 'People Ops',
    };
    vi.mocked(ssoService.exchangeMicrosoftToken).mockResolvedValue(mockSSOData);

    window.history.replaceState({}, '', '/?sso_token=mock.msal.access.token');

    // ACT
    render(<AuthProvider><div /></AuthProvider>);

    // ASSERT
    await waitFor(() => {
      expect(ssoService.exchangeMicrosoftToken).toHaveBeenCalledWith('mock.msal.access.token');
    });
  });

  it('should remove sso_token from the URL after a successful exchange', async () => {
    vi.mocked(ssoService.exchangeMicrosoftToken).mockResolvedValue({
      session_id: 'sess_123',
      employee_id: 1,
      roles: ['Employee'],
      full_name: 'John Smith',
      department: 'Engineering',
    });

    window.history.replaceState({}, '', '/?sso_token=some.token.value&other=keep');

    render(<AuthProvider><div /></AuthProvider>);

    await waitFor(() => {
      expect(window.location.search).not.toContain('sso_token');
    });
    // Other params should be preserved
    expect(window.location.search).toContain('other=keep');
  });

  it('should set user state after a successful SSO exchange', async () => {
    const mockSSOData = {
      session_id: 'sess_xyz',
      employee_id: 7,
      roles: ['Manager'],
      full_name: 'Alice Chen',
      department: 'Engineering',
    };
    vi.mocked(ssoService.exchangeMicrosoftToken).mockResolvedValue(mockSSOData);

    window.history.replaceState({}, '', '/?sso_token=valid.token');

    let capturedUser = null;
    function Consumer() {
      capturedUser = React.useContext(AuthContext)?.user;
      return null;
    }

    render(<AuthProvider><Consumer /></AuthProvider>);

    await waitFor(() => {
      expect(capturedUser).not.toBeNull();
      expect(capturedUser?.employee_id).toBe(7);
      expect(capturedUser?.roles).toContain('Manager');
    });
  });

  it('should NOT call exchangeMicrosoftToken when sso_token is absent', async () => {
    vi.mocked(tokenService.hasToken).mockReturnValue(true);
    vi.mocked(authApi.me).mockResolvedValue({
      data: {
        id: 1,
        full_name: 'Regular User',
        roles: ['Employee'],
        department_name: 'Engineering',
      }
    });

    window.history.replaceState({}, '', '/dashboard');

    render(<AuthProvider><div /></AuthProvider>);

    await waitFor(() => {
      expect(ssoService.exchangeMicrosoftToken).not.toHaveBeenCalled();
    });
    expect(authApi.me).toHaveBeenCalled(); // falls back to session check
  });

  it('should redirect to landing page on logout', async () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: 'http://localhost:3000/dashboard' };

    let triggerLogout = null;
    function Consumer() {
      const { logout } = React.useContext(AuthContext);
      triggerLogout = logout;
      return null;
    }

    render(<AuthProvider><Consumer /></AuthProvider>);

    await triggerLogout();

    expect(window.location.href).toBe('http://localhost:5174');

    window.location = originalLocation;
  });

  it('should fall through to null user when SSO exchange fails', async () => {
    vi.mocked(ssoService.exchangeMicrosoftToken).mockRejectedValue(new Error('Invalid MSAL token'));
    vi.mocked(authApi.me).mockRejectedValue(new Error('No session'));

    window.history.replaceState({}, '', '/?sso_token=bad.token');

    let capturedUser = undefined;
    function Consumer() {
      capturedUser = React.useContext(AuthContext)?.user;
      return null;
    }

    render(<AuthProvider><Consumer /></AuthProvider>);

    await waitFor(() => {
      expect(capturedUser).toBeNull();
    });
  });
});
