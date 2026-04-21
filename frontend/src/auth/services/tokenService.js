// Stores tokens in memory (primary) — no localStorage per security best practice
let _accessToken = null;
let _refreshToken = null;

const tokenService = {
  setTokens(access, refresh) {
    _accessToken = access;
    _refreshToken = refresh;
  },
  getAccessToken() {
    return _accessToken;
  },
  getRefreshToken() {
    return _refreshToken;
  },
  clearTokens() {
    _accessToken = null;
    _refreshToken = null;
  },
  hasToken() {
    return !!_accessToken;
  },
};

export default tokenService;
