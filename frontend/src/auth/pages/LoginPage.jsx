import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Divider, Alert,
  CircularProgress, Paper, Stack, Chip
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import GoogleIcon from '@mui/icons-material/Google';
import MicrosoftIcon from '@mui/icons-material/Window';
import useAuth from '../useAuth';
import ssoService from '../services/ssoService';
// import tokenService from '../services/tokenService';
import ROUTES from '../../config/routes';

const IS_DEV = import.meta.env.DEV;

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
        background: 'linear-gradient(135deg, #0f1b4c 0%, #1a2f6e 50%, #1e3a8a 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative circles */}
      <Box sx={{
        position: 'absolute', top: -80, right: -80,
        width: 320, height: 320, borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
      }} />
      <Box sx={{
        position: 'absolute', bottom: -120, left: -60,
        width: 400, height: 400, borderRadius: '50%',
        background: 'rgba(255,255,255,0.03)', pointerEvents: 'none',
      }} />

      {/* Left brand panel */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'center',
          px: 8,
          color: '#fff',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 4 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography fontWeight={800} fontSize={20} color="#fff">A</Typography>
          </Box>
          <Typography fontWeight={700} fontSize={20} color="rgba(255,255,255,0.9)">
            Executive Portal
          </Typography>
        </Stack>

        <Typography variant="h3" sx={{ fontWeight: 800, color: "#fff", lineHeight: 1.2, mb: 2 }}>
          KRA Management<br />
          <Box component="span" sx={{ color: 'rgba(255,255,255,0.55)' }}>
            System
          </Box>
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.55)", fontSize: 15, maxWidth: 380 }}>
          Manage performance cycles, assign KRAs, track assessments, and
          publish results — all in one place.
        </Typography>

        <Stack spacing={2} mt={6}>
          {['HR Command Center', 'KRA Cycle Management', 'Lead & Self Assessments', 'Reports & Analytics'].map((f) => (
            <Stack key={f} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#60a5fa' }} />
              <Typography color="rgba(255,255,255,0.7)" fontSize={14}>{f}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      {/* Right login card */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: { xs: 1, md: '0 0 480px' },
          px: 3,
          py: 6,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 3,
            p: 4,
            bgcolor: '#fff',
          }}
        >
          {/* Header */}
          <Stack sx={{ alignItems: "center", mb: 3 }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: 2,
              bgcolor: '#1a2f6e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mb: 2,
            }}>
              <LockOutlinedIcon sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Typography variant="h6" fontWeight={700} color="#1a1a2e">
              Sign in to your account
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              KRA Management Platform
            </Typography>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
          )}

          {/* Screen: Choice */}
          {screen === 'choice' && (
            <Stack spacing={2}>   
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<MicrosoftIcon />}
                onClick={() => handleSSOLogin('microsoft')}
                sx={{
                  bgcolor: '#fff',
                  color: '#1a1a2e',
                  border: '1.5px solid #e2e8f0',
                  boxShadow: 'none',
                  fontWeight: 600,
                  '&:hover': { bgcolor: '#f8fafc', boxShadow: 'none' },
                }}
              >
                Continue with Microsoft
              </Button>

              <Divider sx={{ my: 1 }}>
                <Typography variant="caption" color="text.secondary">or</Typography>
              </Divider>

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={() => setScreen('email')}
                sx={{
                  bgcolor: '#1a2f6e',
                  fontWeight: 600,
                  borderRadius: 2,
                  '&:hover': { bgcolor: '#162560' },
                }}
              >
                Sign in with Email
              </Button>
            </Stack>
          )}

          {/* Screen: Email + Password */}
          {screen === 'email' && (
            <Box component="form" onSubmit={handleEmailLogin}>
              <Stack spacing={2}>
                <TextField
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  autoFocus
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{
                    bgcolor: '#1a2f6e',
                    fontWeight: 600,
                    borderRadius: 2,
                    mt: 1,
                    '&:hover': { bgcolor: '#162560' },
                  }}
                >
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
                </Button>

                <Button
                  fullWidth
                  variant="text"
                  size="small"
                  onClick={() => { setScreen('choice'); setError(''); }}
                  sx={{ color: 'text.secondary', fontWeight: 500 }}
                >
                  ← Back to sign in options
                </Button>
              </Stack>
            </Box>
          )}

          <Box sx={{ mt: 3, textAlign: "center" }}>
            <Chip
              label="Admin Access Only"
              size="small"
              sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontSize: 11 }}
            />
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
