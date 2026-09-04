import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The backend owns /api, /auth and /callback; everything else is the SPA.
const API_TARGET = process.env.API_TARGET ?? "http://127.0.0.1:8888";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
      "/auth": { target: API_TARGET, changeOrigin: true },
      "/callback": { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    // Never ship a source map in the served build — packages/web/dist is
    // served as-is by @fastify/static, so a map here is publicly fetchable
    // and reconstructs the pre-minification source.
    sourcemap: false,
  },
});
