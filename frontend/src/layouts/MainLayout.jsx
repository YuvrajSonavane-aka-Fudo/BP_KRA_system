import { Box, AppBar, Toolbar, IconButton, Typography, Stack, Avatar } from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import SettingsIcon from '@mui/icons-material/Settings';
import Sidebar from './Sidebar';
import useAuth from '../auth/useAuth';

export default function MainLayout({ children }) {
  const { user } = useAuth();

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f6fa' }}>
      <Sidebar />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: '#fff',
            borderBottom: '1px solid #e2e8f0',
            color: '#1a1a2e',
          }}
        >
          <Toolbar sx={{ minHeight: '56px !important', px: 3 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              HR Command Center
            </Typography>

            <Box sx={{ flex: 1 }} />

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                <HelpIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                <SettingsIcon fontSize="small" />
              </IconButton>
              <Avatar sx={{ width: 30, height: 30, bgcolor: '#1a2f6e', fontSize: 11, fontWeight: 700, ml: 0.5 }}>
                {initials}
              </Avatar>
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
