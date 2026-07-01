import React, { createContext, useState, useCallback, useEffect } from 'react';
import authService from './services/authService';
import authApi from '../api/authApi';  // adjust path to match your project

import ssoService from './services/ssoService';
import tokenService from './services/tokenService';

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [initialized, setInitialized] = useState(false);

  // ── Restore session on every page load/refresh ──────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('sso_token');

    if (ssoToken) {
      ssoService.exchangeMicrosoftToken(ssoToken)
        .then(res => {
          setUser({
            employee_id: res.employee_id,
            full_name:   res.full_name,
            roles:       res.roles,
            department:  res.department,
          });

          // Clean up the URL parameter
          params.delete('sso_token');
          const newSearch = params.toString();
          const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`;
          window.history.replaceState({}, '', newUrl);
        })
        .catch(err => {
          console.error("SSO token exchange failed:", err);
          setUser(null);
        })
        .finally(() => {
          setInitialized(true);
        });
    } else if (tokenService.hasToken()) {
      authApi.me()
        .then(res => {
          setUser({
            employee_id: res.data.id,
            full_name:   res.data.full_name,
            roles:       res.data.roles,
            department:  res.data.department_name,
          });
        })
        .catch(() => {
          setUser(null);
        })
        .finally(() => {
          setInitialized(true);
        });
    } else {
      setUser(null);
      setInitialized(true);
    }
  }, []);

  // ── Listen for 401/403 fired by axiosInstance interceptor ───────────────
  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('kra:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('kra:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      setUser({
        employee_id: data.employee_id,
        full_name:   data.full_name,
        roles:       data.roles,
        department:  data.department,
      });
      return { success: true };
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        'Invalid credentials. Please try again.';
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    window.location.href = "http://localhost:5174";
  }, []);

  // ── Don't render anything until we've checked the session ───────────────
  if (!initialized) return null; // or a spinner/loading screen

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}