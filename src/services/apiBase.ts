/**
 * Base URL for every call to our own API.
 *
 * Empty by default, so requests stay same-origin — that is the case both in
 * dev (Vite proxies /api to the API server) and in a single-service deploy
 * where the API also serves this bundle.
 *
 * Set VITE_API_URL at build time when the frontend is hosted separately
 * (e.g. frontend on Vercel, API on Render). The API must then list the
 * frontend origin in CORS_ORIGIN.
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** Absolute URL for an app API path (`/api/...`). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
