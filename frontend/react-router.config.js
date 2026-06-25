/** @type {import("@react-router/dev/config").Config} */
export default {
  // Keep SPA mode — no server-side rendering, no Node.js server required.
  ssr: false,

  // Use src/ as the framework app directory (avoids renaming the existing folder).
  appDirectory: 'src',

  // Disable prerender: env.js reads window.location.origin which is only available
  // in the browser — the SSR prerender pass runs in Node where window doesn't exist.
  // The SPA is fully client-rendered; no static HTML pre-generation needed.
  prerender: false,
};
