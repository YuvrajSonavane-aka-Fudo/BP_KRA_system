/**
 * ClientApp.jsx — Client-only wrapper for MUI + AuthProvider.
 *
 * This module is imported lazily inside root.jsx so that @mui/material
 * (which accesses `document` and `window` at module evaluation time) is
 * NEVER evaluated during Node-side SSR or build-time prerender.
 *
 * The framework calls root.jsx in Node; React.lazy ensures this file
 * only executes in the browser where DOM APIs are available.
 */
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import AuthProvider from './auth/AuthProvider';

const theme = createTheme({
  palette: {
    primary:    { main: '#1E3A8A' },
    secondary:  { main: '#2d4fd6' },
    background: { default: '#f5f6fa', paper: '#ffffff' },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 } },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
  },
});

export default function ClientApp({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
