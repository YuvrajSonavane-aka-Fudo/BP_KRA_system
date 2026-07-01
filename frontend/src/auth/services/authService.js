import axiosInstance from '../../api/axiosInstance';
import tokenService from './tokenService';

/**
 * authService — wraps Django session-based auth endpoints.
 *
 * POST /kra/auth/login  → { session_id, employee_id, roles, full_name, department }
 * POST /kra/auth/logout → { message }
 */
const authService = {
  async login(email, password) {
    const response = await axiosInstance.post('auth/login', { email, password });
    const data = response.data;
    if (data.access_token) {
      tokenService.setTokens(data.access_token, data.refresh_token);
    }
    // Return unified object mapping backend keys to frontend keys
    return {
      session_id: data.access_token,
      employee_id: data.user.id,
      full_name: data.user.full_name,
      roles: data.user.roles || [],
      department: data.user.department_name,
    };
  },

  async logout() {
    try {
      await axiosInstance.post('auth/logout');
    } catch {
      // Swallow — always clear local state on logout
    } finally {
      tokenService.clearTokens();
    }
  },
};

export default authService;
