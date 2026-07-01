import axios from 'axios';
import env from '../config/env';

import tokenService from '../auth/services/tokenService';

/**
 * Axios instance — Django JWT/Token auth.
 */
const axiosInstance = axios.create({
  baseURL: env.API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = tokenService.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor ────────────────────────────────────────────────────
// On 401/403 we fire a custom DOM event so AuthProvider can clear state
// without creating a circular import (AuthProvider → axiosInstance → AuthProvider).
axiosInstance.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // Let AuthProvider listen to this and wipe user state.
      window.dispatchEvent(new CustomEvent('kra:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
