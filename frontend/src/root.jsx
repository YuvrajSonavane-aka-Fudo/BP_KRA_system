/**
 * root.jsx — React Router Framework Mode application shell.
 *
 * This file is evaluated in BOTH Node (during build prerender) and the browser.
 * Therefore we MUST NOT import MUI directly — MUI accesses document/window at
 * module-evaluation time and crashes Node.
 *
 * Pattern: React.lazy + Suspense for the MUI subtree ensures MUI is only
 * ever evaluated in the browser.
 *
 * Exports:
 *   Layout        — HTML document shell (safe in Node — no MUI)
 *   default       — App root (lazy-loads MUI client wrapper)
 *   ErrorBoundary — Top-level route error handler
 */
import React, { lazy, Suspense } from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
  useNavigate,
} from 'react-router';
import './assets/styles/global.css';

// ── Lazy-load the MUI + AuthProvider wrapper (client-only) ────────────────────
// React.lazy guarantees this module is never evaluated in Node.
const ClientApp = lazy(() => import('./ClientApp.jsx'));

// ── Loading fallback shown while ClientApp chunk loads ─────────────────────────
function AppLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: '"Inter", sans-serif',
        background: '#f5f6fa',
        color: '#1E3A8A',
        fontSize: 14,
      }}
    >
      Loading…
    </div>
  );
}

// ── HTML document shell ───────────────────────────────────────────────────────
// Safe in Node — contains no MUI, no DOM API access.
export function Layout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="data:," />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// ── App root — lazy-loads MUI ClientApp wrapper ───────────────────────────────
export default function Root() {
  return (
    <Suspense fallback={<AppLoader />}>
      <ClientApp>
        <Outlet />
      </ClientApp>
    </Suspense>
  );
}

// ── Top-level route error boundary ───────────────────────────────────────────
// Minimal — avoids MUI to ensure it renders safely if something goes wrong
// before ClientApp has loaded.
export function ErrorBoundary() {
  const error    = useRouteError();
  const navigate = useNavigate();

  let statusText   = '';
  let errorMessage = 'An unexpected error occurred.';

  if (isRouteErrorResponse(error)) {
    statusText   = `${error.status} ${error.statusText}`;
    errorMessage = error.data?.message || error.statusText || errorMessage;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  console.error('[Route Error Boundary]', error);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '80vh', padding: 24, background: '#f5f6fa',
        fontFamily: '"Inter", sans-serif',
      }}
    >
      <div
        style={{
          padding: 40, maxWidth: 500, width: '100%', textAlign: 'center',
          background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontWeight: 700, color: '#1E3A8A', margin: '0 0 8px' }}>Oops!</h1>
        {statusText && (
          <p style={{ fontWeight: 600, color: '#666', margin: '0 0 8px' }}>{statusText}</p>
        )}
        <p style={{ color: '#666', margin: '0 0 32px' }}>{errorMessage}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '10px 20px', borderRadius: 8, background: '#1E3A8A',
              color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Go Back
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '10px 20px', borderRadius: 8, background: 'transparent',
              color: '#1E3A8A', border: '1.5px solid #1E3A8A', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
