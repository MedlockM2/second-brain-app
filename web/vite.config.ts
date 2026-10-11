import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A plain single-page app: every route is answered by index.html, client-side
// (React Router). Port 5173 is the origin the dev API's CORS allows
// (`web_app_origin` in infrastructure/terraform/envs/dev/main.tf), hence
// `strictPort`: a silent fallback to 5174 would only surface as CORS errors.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  // The eleven shared catalogues are bundled on purpose (packages/core/src/i18n/
  // catalogs.ts): an instant language switch and no network for the interface.
  // They are most of the bundle, so Vite's 500 kB warning would fire on every build.
  build: { chunkSizeWarningLimit: 1000 },
  preview: { port: 5173, strictPort: true },
});
