import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import ssoService from '../services/ssoService';
import useAuth from '../useAuth';
import ROUTES from '../../config/routes';

export default function SSOCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { loginWithSSOData } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = params.get('code');
    const provider = params.get('provider') || params.get('state') || 'google';

    if (!code) {
      setError('SSO callback missing authorization code.');
      return;
    }

    ssoService
      .handleCallback(code, provider)
      .then((data) => {
        loginWithSSOData(data);
        navigate(ROUTES.DASHBOARD, { replace: true });
      })
      .catch((err) => {
        const msg = err?.response?.data?.detail || 'SSO authentication failed. Please try again.';
        setError(msg);
      });
  }, []); // eslint-disable-line

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f1b4c 0%, #1a2f6e 100%)',
        gap: 2,
      }}
    >
      {error ? (
        <Alert severity="error" sx={{ maxWidth: 400 }}>{error}</Alert>
      ) : (
        <>
          <CircularProgress sx={{ color: '#fff' }} />
          <Typography sx={{ fontSize: 15, color: 'rgba(255,255,255,0.8)' }}  >
            Completing sign in…
          </Typography>
        </>
      )}
    </Box>
  );
}
