import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "node:url";

/**
 * `import.meta.dirname` only exists on Node >= 20.11 — on anything older it is
 * `undefined` and every path.resolve() below throws, failing the build with a
 * bare exit code 1. Deriving it from import.meta.url works on every Node that
 * can run Vite, so the build no longer depends on the host's Node version.
 */
const configDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * PORT/BASE_PATH are optional. They exist so a host that dictates the port
 * (Netlify preview, a container, a reverse proxy under a sub-path) can inject
 * them; local dev and CI builds fall back to the Vite defaults.
 */
const rawPort = process.env.PORT;
const port = Number(rawPort ?? 5173);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

/**
 * Dev-only proxy target for the API. Unused by default — the app calls the
 * backend directly (see src/services/apiBase.ts). It only comes into play
 * with VITE_API_URL=proxy, which is the way to dodge CORS in dev or to work
 * against a local backend (API_PROXY_TARGET=http://localhost:3000).
 */
const apiProxyTarget =
  process.env.API_PROXY_TARGET ??
  "https://crypto-scanner-back-production.up.railway.app";

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(configDir, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: configDir,
  build: {
    outDir: path.resolve(configDir, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      // Same-origin /api so the browser never sees a cross-origin call.
      // Only reached when VITE_API_URL=proxy.
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes, req) => {
            if (req.url?.includes("/klines/stream")) {
              proxyRes.headers["cache-control"] = "no-cache";
              proxyRes.headers["x-accel-buffering"] = "no";
            }
          });
        },
      },
      // Dev-only direct Binance passthrough. In production the same calls go
      // through the backend's /api/binance proxy.
      "/binance-api": {
        target: "https://api.binance.com",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/binance-api/, "/api/v3"),
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
