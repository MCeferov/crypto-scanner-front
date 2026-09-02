/**
 * Base URL for every call to our own API.
 *
 * Always absolute: the browser calls the deployed backend directly, in dev and
 * in production alike, so the URL you see in DevTools is the real backend.
 *
 * Override at BUILD time with VITE_API_URL when the API moves (Netlify → Site
 * settings → Environment variables). The value is baked into the bundle, so
 * changing it requires a rebuild, not just a restart.
 *
 * Because the calls are cross-origin, the backend must return
 * Access-Control-Allow-Origin for the frontend's origin (its FRONTEND_URL
 * allowlist) — both http://localhost:5173 for dev and the deployed site.
 *
 * Escape hatch: VITE_API_URL=proxy makes the base empty, so requests stay
 * same-origin and the Vite dev server proxies /api to API_PROXY_TARGET
 * (see vite.config.ts). Useful when CORS is not configured yet.
 */
const DEFAULT_API_URL = 'https://crypto-scanner-back-production.up.railway.app';

const configured = (import.meta.env.VITE_API_URL ?? '').trim();

export const API_BASE = (
  configured === 'proxy' ? '' : configured || DEFAULT_API_URL
).replace(/\/$/, '');

/** Absolute URL for an app API path (`/api/...`). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
