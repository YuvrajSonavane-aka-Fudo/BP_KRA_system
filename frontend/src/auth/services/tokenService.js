const TOKEN_KEY = "kra_access_token";
const REFRESH_KEY = "kra_refresh_token";

const tokenService = {
  setTokens(access, refresh) {
    if (access) localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  getAccessToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY);
  },
  clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
  hasToken() {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};

export default tokenService;
