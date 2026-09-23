import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Absolute base: the public site and the admin dashboard are now one
  // build served from one FastAPI process at the domain root (see
  // backend/app/main.py's SPA fallback), and the admin routes live at
  // arbitrary depth (e.g. /admin/leads/42) — a relative "./" base would
  // resolve asset URLs against that depth instead of the real root on a
  // hard refresh. If you ever need to drop the build into a subfolder
  // again, override with `vite build --base=/subfolder/`.
  base: "/",

  server: {
    port: 5173,
    // Never fail because a port is taken — pick the next free one instead.
    strictPort: false,
    open: false,
    proxy: {
      // Public site API calls (see backend/README / PASS1_NOTES.md) so
      // the same relative-path fetch("api/...") calls work both in dev
      // and in the built app.
      "/api": {
        target: "http://localhost:7001",
        changeOrigin: true,
        // Don't hard-fail dev server startup if the backend isn't running;
        // the client already falls back to bundled content on error.
        configure: (proxy) => {
          proxy.on("error", () => {});
        },
      },
      // Admin dashboard API calls (see src/admin/api/client.js) — a
      // separate prefix from "/api" above since the admin's session
      // cookie/CSRF flow is scoped under /admin/api on the backend.
      "/admin/api": {
        target: "http://localhost:7001",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", () => {});
        },
      },
      // Uploaded brand assets (logo, favicon) — served by the backend
      // from backend/data/uploads/, referenced by branding.logo_url /
      // branding.favicon_url as root-relative paths.
      "/uploads": {
        target: "http://localhost:7001",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", () => {});
        },
      },
    },
  },

  preview: {
    port: 4173,
    strictPort: false,
  },
});
