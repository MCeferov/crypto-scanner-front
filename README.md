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

## Local development

The backend must be running on `http://localhost:3000` (see its README).

```bash
pnpm dev          # http://localhost:5173
```

In development `/api/*` is proxied to `API_PROXY_TARGET` by the Vite dev
server, so requests stay same-origin and CORS is never involved. Leave
`VITE_API_URL` empty locally.

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
| `VITE_API_URL` | build time | Absolute backend origin. **Empty locally** (the dev proxy handles it); set to the Railway URL on Netlify. Baked into the bundle — changing it needs a rebuild. |
| `API_PROXY_TARGET` | dev only | Dev-server proxy target. Default `http://localhost:3000`. |
| `PORT` | dev only | Dev/preview port. Default `5173`. |
| `BASE_PATH` | build/dev | Sub-path the app is served from. Default `/`. |

## Deployment (Netlify)

`netlify.toml` is committed and configures build, SPA fallback and cache
headers. In **Site settings → Environment variables** add:

```
VITE_API_URL = https://<your-backend>.up.railway.app
```

Then redeploy — the value is compiled into the bundle.

The backend must list this site's origin in its `FRONTEND_URL` allowlist or
every API call fails CORS.

## Notes

- Binance market-data WebSockets connect directly from the browser to
  `wss://stream.binance.com` — they do not go through the backend.
- Translations live in `src/i18n/` and are bundled. The same source exists in
  the backend repo (it serves `/api/i18n/*`); keep the two copies in sync when
  editing translations.
