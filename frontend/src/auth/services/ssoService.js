import axiosInstance from '../../api/axiosInstance';
import env from '../../config/env';
import tokenService from './tokenService';

const ssoService = {
  redirectToProvider(provider) {
    // Redirect browser to SSO provider (Google/Microsoft/Okta etc.)
    const params = new URLSearchParams({
      client_id: env.SSO_CLIENT_ID,
      redirect_uri: env.SSO_REDIRECT_URI,
      provider,
      response_type: 'code',
    });
    // window.location.href = `http://localhost:8000/api/v1/auth/microsoft/login`;
    window.location.href = `${env.API_BASE_URL}auth/microsoft/login`;
  },

  async exchangeMicrosoftToken(token) {
    const response = await axiosInstance.post('auth/microsoft-login', { access_token: token });
    const data = response.data;
    if (data.access_token) {
      tokenService.setTokens(data.access_token, data.refresh_token);
    }
    return {
      session_id: data.access_token, // for compatibility
      employee_id: data.user.id,
      full_name: data.user.full_name,
      roles: data.user.roles || [],
      department: data.user.department_name,
    };
  },

  async getCurrentUser() {
    const response = await axiosInstance.get('auth/me');
    return response.data;
  },
};

export default ssoService;
