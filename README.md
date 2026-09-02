# crypto-heatmap-frontend

React 19 + TypeScript + Vite + Tailwind CSS 4 SPA for the crypto market
scanner: RSI heatmap, TradingView-style charts with drawing tools, Supply/
Demand zones, chart-pattern detection and a configurable signal engine.

The API lives in a separate repository (`crypto-heatmap-backend`) and is
reached over HTTP only — this repo contains no backend code.

## Requirements

- Node.js >= 22.12
- pnpm 11 (`corepack enable`)

## Setup

```bash
pnpm install
cp .env.example .env      # then edit
```

## Backend

The API runs on Railway at:

```
https://crypto-scanner-back-production.up.railway.app
```

The browser calls it **directly** in dev and in production alike, so the URL
in DevTools is the real backend. The default lives in
`src/services/apiBase.ts`; override it with `VITE_API_URL` if the API moves.

Because every call is cross-origin, the backend must return
`Access-Control-Allow-Origin` for this app's origin — add both
`http://localhost:5173` and the deployed site to its `FRONTEND_URL`
allowlist, or the browser blocks the requests.

## Local development

```bash
pnpm dev          # http://localhost:5173
```

Leave `VITE_API_URL` empty — dev uses the same Railway backend, called
directly.

If CORS is not configured on the backend yet, set `VITE_API_URL=proxy` in
`.env`. Requests then stay same-origin and the Vite dev server forwards
`/api/*` to `API_PROXY_TARGET`, sidestepping CORS entirely. The same switch
is how you develop against a local backend
(`API_PROXY_TARGET=http://localhost:3000`).

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server on :5173 with the `/api` proxy |
| `pnpm build` | Production bundle into `dist/` |
| `pnpm preview` | Serve the built bundle locally |
| `pnpm typecheck` | `tsc --noEmit` |

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_API_URL` | build time | Absolute backend origin. Optional — defaults to the Railway URL everywhere. The literal `proxy` switches dev to same-origin + the Vite proxy. Baked into the bundle — changing it needs a rebuild. |
| `API_PROXY_TARGET` | dev only | Where the proxy forwards `/api`, used only with `VITE_API_URL=proxy`. Defaults to the Railway backend. |
| `PORT` | dev only | Dev/preview port. Default `5173`. |
| `BASE_PATH` | build/dev | Sub-path the app is served from. Default `/`. |

## Deployment (Netlify)

`netlify.toml` is committed and configures build, SPA fallback and cache
headers. No environment variables are required: the build already targets
the Railway backend. To point a deploy somewhere else, add

```
VITE_API_URL = https://<your-backend>.up.railway.app
```

in **Site settings → Environment variables** and redeploy — the value is
compiled into the bundle.

The backend must list this site's origin in its `FRONTEND_URL` allowlist or
every API call fails CORS.

## Notes

- Binance market-data WebSockets connect directly from the browser to
  `wss://stream.binance.com` — they do not go through the backend.
- Translations live in `src/i18n/` and are bundled. The same source exists in
  the backend repo (it serves `/api/i18n/*`); keep the two copies in sync when
  editing translations.
