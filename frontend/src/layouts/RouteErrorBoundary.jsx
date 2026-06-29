import React from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router';
import { Box, Typography, Button, Paper } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  let errorMessage = "An unexpected error occurred.";
  let statusText = "";

  if (isRouteErrorResponse(error)) {
    statusText = `${error.status} ${error.statusText}`;
    errorMessage = error.data?.message || error.statusText || errorMessage;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  // Log to console for developer troubleshooting
  console.error("Route Error Boundary caught an error:", error);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        p: 3,
        bgcolor: '#f5f6fa',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 5,
          maxWidth: 500,
          width: '100%',
          textAlign: 'center',
          borderRadius: 3,
          boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
        }}
      >
        <WarningAmberIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#1E3A8A' }}>
          Oops!
        </Typography>
        {statusText && (
          <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
            {statusText}
          </Typography>
        )}
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {errorMessage}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="contained" color="primary" onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <Button variant="outlined" color="primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
