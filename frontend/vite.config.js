import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';

/**
 * Vite config for React Router Framework Mode.
 *
 * The `reactRouter()` plugin from @react-router/dev/vite replaces
 * `@vitejs/plugin-react` — it wraps React transform internally and
 * adds code-splitting, type generation, and SPA build support.
 *
 * Framework config lives in react-router.config.js (ssr: false, appDirectory: 'src').
 */
export default defineConfig({
  plugins: [
    reactRouter(),
  ],
  server: {
    port: 3000,
    open: true,
  },
});
