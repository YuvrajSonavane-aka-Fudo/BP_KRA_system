import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import useAuth from '../auth/useAuth';

export default function MainLayout({ children }) {
  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: '#f5f6fa' }}>
      <Sidebar />

      {/* Main content — grows to fill remaining space as sidebar collapses */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,          // allow shrinking below intrinsic width
          overflow: 'hidden',   // DashboardPage controls its own overflow
          transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}