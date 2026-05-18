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
    // window.location.href = `http://localhost:8000/api/v1/auth/microsoft/login`;
    window.location.href = `${env.API_BASE_URL}auth/microsoft/login`;
  },

 async getCurrentUser() {
    const response = await axiosInstance.get('auth/me');
    return response.data;
  },
};

export default ssoService;
