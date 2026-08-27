import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The backend owns /api, /auth and /callback; everything else is the SPA.
const API_TARGET = process.env.API_TARGET ?? "http://127.0.0.1:8888";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
      "/auth": { target: API_TARGET, changeOrigin: true },
      "/callback": { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
