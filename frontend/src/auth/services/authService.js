import axiosInstance from '../../api/axiosInstance';

/**
 * authService — wraps Django session-based auth endpoints.
 *
 * POST /kra/auth/login  → { session_id, employee_id, roles, full_name, department }
 * POST /kra/auth/logout → { message }
 */
const authService = {
  async login(email, password) {
    const response = await axiosInstance.post('auth/login', { email, password });
    return response.data;
    // Returns: { session_id, employee_id, roles, full_name, department }
  },

  async logout() {
    try {
      await axiosInstance.post('auth/logout');
    } catch {
      // Swallow — always clear local state on logout
    }
  },
};

export default authService;
