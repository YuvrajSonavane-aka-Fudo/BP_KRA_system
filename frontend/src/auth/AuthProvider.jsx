import React, { createContext, useState, useCallback } from 'react';
import authService from './services/authService';

export const AuthContext = createContext(null);

/**
 * AuthProvider — manages the authenticated user state.
 *
 * Session cookie is handled automatically by the browser (withCredentials).
 * We only keep a lightweight user object in React state so components
 * know who is logged in without re-fetching.
 */
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { employee_id, full_name, roles, department }
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      // Backend returns: { session_id, employee_id, roles, full_name, department }
      setUser({
        employee_id: data.employee_id,
        full_name: data.full_name,
        roles: data.roles,           // e.g. ["Admin"] or ["Employee"]
        department: data.department,
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
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
