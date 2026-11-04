import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { releaseManifest, validatePublicConfig } from "./tooling/release";

export default defineConfig(({ command, mode }) => {
  const publicConfig = command === "build"
    ? validatePublicConfig(loadEnv(mode, process.cwd(), "VITE_"), mode === "ci")
    : null;
  return {
    plugins: [react(), publicConfig && releaseManifest(mode, publicConfig)],
    // The dev API allows exactly this origin; never silently fall back to 5174.
    server: { port: 5173, strictPort: true },
    // All eleven shared catalogues are bundled for instant language switching.
    build: { chunkSizeWarningLimit: 1000 },
    preview: { port: 5173, strictPort: true },
  };
});
