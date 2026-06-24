import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Divider, Alert,
  CircularProgress, Paper, Stack, Chip
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MicrosoftIcon from '@mui/icons-material/Window';
import useAuth from '../useAuth';
import ssoService from '../services/ssoService';
import ROUTES from '../../config/routes';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [screen, setScreen] = useState('choice'); // 'choice' | 'email'

  async function handleEmailLogin(e) {
    e.preventDefault();
    setError('');
    const result = await login(email, password);
    if (result.success) {
      navigate(ROUTES.DASHBOARD, { replace: true });
    } else {
      setError(result.error);
    }
  }

  function handleSSOLogin(provider) {
    ssoService.redirectToProvider(provider);
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      {/* LEFT PANEL: Blue Branding (50%) */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1, // Takes exactly 50%
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center', // Centers content horizontally in the left half
          color: '#fff',
          background: 'linear-gradient(135deg, #0f1b4c 0%, #1a2f6e 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <Box sx={{
          position: 'absolute', top: -50, right: -50,
          width: 300, height: 300, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }} />
        <Box sx={{
          position: 'absolute', bottom: -100, left: -50,
          width: 350, height: 350, borderRadius: '50%',
          background: 'rgba(255,255,255,0.03)',
        }} />

        <Box sx={{ position: 'relative', zIndex: 1, px: 6, maxWidth: 500 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 4 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 1.5,
              bgcolor: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Typography sx={{ fontSize: 18, fontWeight: 800 }}  >A</Typography>
            </Box>
            <Typography sx={{ letterSpacing: 0.5, fontSize: 18, fontWeight: 600 }}   >
              Executive Portal
            </Typography>
          </Stack>

          <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.2, mb: 2 }}>
            KRA Management<br />
            <Box component="span" sx={{ opacity: 0.5 }}>System</Box>
          </Typography>
          
          <Typography sx={{ opacity: 0.7, fontSize: 16, mb: 6 }}>
            Manage performance cycles, assign KRAs, track assessments, and
            publish results — all in one place.
          </Typography>

          <Stack spacing={2.5}>
            {['HR Command Center', 'KRA Cycle Management', 'Lead & Self Assessments', 'Reports & Analytics'].map((f) => (
              <Stack key={f} direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#60a5fa' }} />
                <Typography sx={{ opacity: 0.8, fontSize: 14, fontWeight: 500 }}>{f}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* RIGHT PANEL: Login Form (50%) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1, // Takes exactly 50%
          bgcolor: '#f8fafc', 
          px: 3,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 5,
            p: { xs: 4, md: 5 },
            bgcolor: '#fff',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.02)',
          }}
        >
          <Stack sx={{ alignItems: "center", mb: 4 }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: '16px',
              bgcolor: '#1a2f6e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mb: 2.5,
            }}>
              <LockOutlinedIcon sx={{ color: '#fff', fontSize: 28 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}  >
              Sign in to your account
            </Typography>
            <Typography variant="body2"  sx={{ mt: 0.5, color: 'text.secondary' }}>
              KRA Management Platform
            </Typography>
          </Stack>

          {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

          {screen === 'choice' ? (
            <Stack spacing={2}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                startIcon={<MicrosoftIcon />}
                onClick={() => handleSSOLogin('microsoft')}
                sx={{
                  py: 1.5,
                  borderRadius: 2.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#334155',
                  borderColor: '#e2e8f0',
                  '&:hover': { bgcolor: '#f1f5f9', borderColor: '#cbd5e1' }
                }}
              >
                Continue with Microsoft
              </Button>

              <Divider sx={{ my: 1.5 }}>
                <Typography variant="caption"  sx={{ px: 1, color: 'text.disabled' }}>or</Typography>
              </Divider>

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={() => setScreen('email')}
                sx={{
                  py: 1.5,
                  borderRadius: 2.5,
                  bgcolor: '#1a2f6e',
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#0f1b4c', boxShadow: 'none' }
                }}
              >
                Sign in with Email
              </Button>
            </Stack>
          ) : (
            <Box component="form" onSubmit={handleEmailLogin}>
              <Stack spacing={2.5}>
                <TextField
                  label="Email address"
                  type="email"
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                />
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{
                    py: 1.5,
                    borderRadius: 2.5,
                    bgcolor: '#1a2f6e',
                    textTransform: 'none',
                    fontWeight: 600
                  }}
                >
                  {loading ? <CircularProgress size={24} sx={{ color: 'inherit' }}  /> : 'Sign In'}
                </Button>
                <Button
                  fullWidth
                  variant="text"
                  onClick={() => setScreen('choice')}
                  sx={{ textTransform: 'none', color: 'text.secondary', fontWeight: 500 }}
                >
                  ← Back to sign in options
                </Button>
              </Stack>
            </Box>
          )}

          <Box sx={{ mt: 4, textAlign: "center" }}>
            <Chip
              label="Admin Access Only"
              size="small"
              sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: 11 }}
            />
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}