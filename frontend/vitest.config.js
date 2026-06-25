import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom to simulate a browser environment
    environment: 'jsdom',

    // Inject describe/it/expect/vi globally (no need to import in every test)
    globals: true,

    // Run setup file before each test file
    setupFiles: ['./src/test/setup.js'],

    // Exclude node_modules and build output
    exclude: ['node_modules', 'dist'],

    // Fix: MUI v9 ships ESM with directory imports that jsdom/Node can't resolve.
    // Map the offending package to its CJS bundle so tests run without errors.
    server: {
      deps: {
        // Force Vitest's internal Vite server to inline (transform) MUI and its deps
        // so their ESM directory imports are resolved correctly in jsdom.
        inline: [
          /^@mui\/.*/,
          /^react-transition-group/,
        ],
      },
    },

    // Coverage configuration (optional — run with: npm run test:coverage)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**', 'src/assets/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});

