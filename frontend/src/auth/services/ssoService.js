import axiosInstance from '../../api/axiosInstance';
import env from '../../config/env';

const ssoService = {
  redirectToProvider(provider) {
    // Redirect browser to SSO provider (Google/Microsoft/Okta etc.)
    const params = new URLSearchParams({
      client_id: env.SSO_CLIENT_ID,
      redirect_uri: env.SSO_REDIRECT_URI,
      provider,
      response_type: 'code',
    });
    window.location.href = `${env.API_BASE_URL}/api/v1/auth/sso/initiate?${params}`;
  },

  async handleCallback(code, provider) {
    // Exchange SSO code for our JWT
    const response = await axiosInstance.post('/api/v1/auth/sso', {
      provider,
      token: code,
    });
    return response.data;
    // Returns same shape as normal login: { access_token, refresh_token, employee_id, roles, full_name }
  },
};

export default ssoService;
