import React from 'react';
import { Box } from '@mui/material';

export default function AuthLayout({ children }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {children}
    </Box>
  );
}
