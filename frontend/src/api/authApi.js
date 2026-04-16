import axiosInstance from './axiosInstance';

/**
 * authApi — thin wrappers around Django session-based auth endpoints.
 *
 * POST /api/v1/auth/login   → { session_id, employee_id, roles, full_name, department }
 * POST /api/v1/auth/logout  → { message }
 * GET  /api/v1/auth/me      → same shape as login response (session validation)
 */
const authApi = {
  login: (email, password) =>
    axiosInstance.post('auth/login', { email, password }),

  logout: () =>
    axiosInstance.post('auth/logout'),

  /**
   * Validate the existing session cookie and return the current user.
   * Called on app mount to restore persisted auth state.
   * The backend should return 401 if no valid session exists.
   */
  // me: () =>
  //   axiosInstance.get('auth/login'),
};

export default authApi;
