const env = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1/' || 'https://bp-kra-system.onrender.com/api/v1/',
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  SSO_CLIENT_ID: import.meta.env.VITE_SSO_CLIENT_ID || '',
  SSO_REDIRECT_URI: import.meta.env.VITE_SSO_REDIRECT_URI || `${window.location.origin}/auth/sso/callback`,
};

export default env;
