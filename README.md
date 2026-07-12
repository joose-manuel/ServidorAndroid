# ServidorAndroid · Edge Node Network Manager

> Samsung S9 repurposed as a 24/7 Edge server for home-network automation, exposed through three coordinated apps.

This repository is the **Nx monorepo** for the project — the canonical architecture, backlog and UX spec live in `Documentacion_Edge_Node.docx` and `Documentacion_UXUI_Retro.docx`. Read those first, then come back here for the build/run/deploy details.

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web  — Angular 18 admin panel            → Netlify    │
│  apps/api  — NestJS 10 backend (REST + WS)     → Fly.io     │
│  apps/edge — Ionic 7 + Capacitor 6 (Android)   → APK signed │
└─────────────────────────────────────────────────────────────┘
                ▲                ▲                ▲
                └────────────────┴────────────────┘
                       shared via libs/*

libs/shared/types         shared TS interfaces (User, Modem, Metric, …)
libs/shared/dto           request/response shapes shared by web + api
libs/shared/utils         pure helpers (date, network, crypto, severity)
libs/shared/supabase      channel/event name constants + config reader
libs/ui/design-tokens     retro-telemetry color/type/spacing tokens
libs/ui/components        <hud-panel>, <status-badge>, <cmd-button>, …
```

## Quick start

```bash
# 1. Install (Node 20 via .nvmrc)
nvm use
npm ci        # uses .npmrc → legacy-peer-deps=true (see AGENTS.md)

# 2. Prepare environment
cp infra/env/.env.example infra/env/.env
# (fill in real values for Supabase, Postgres, TURN)

# 3. Run any app
npm run front      # http://localhost:4200   (Angular admin panel)
npm run back       # http://localhost:3000/api (NestJS API + WebSocket)
npm run android    # http://localhost:8100   (Ionic app in browser)

# 4. Build / test / lint
npm run build
npm run lint
npm run test
```

> `npm ci` / `npm install` will read `.npmrc` and pass `--legacy-peer-deps` automatically. If you ever run npm from a context that ignores `.npmrc`, add the flag manually: `npm install --legacy-peer-deps`.

## Repository layout

| Path                                | Purpose                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| `apps/web/`                         | Angular 18 admin panel (see `apps/web/README.md`)           |
| `apps/api/`                         | NestJS 10 backend (see `apps/api/README.md`)                |
| `apps/edge/`                        | Ionic + Capacitor mobile app (see `apps/edge/README.md`)    |
| `libs/shared/{types,dto,utils,supabase}` | Cross-app TS modules (Nx libraries)                    |
| `libs/ui/{design-tokens,components}`    | Shared UI library (tokens + Angular standalone components) |
| `infra/docker/api.Dockerfile`       | Multi-stage Dockerfile for the NestJS API                   |
| `infra/coturn/turnserver.conf`      | Reference config for the WebRTC TURN/STUN server           |
| `infra/env/.env.example`            | All env vars the apps read, with documentation              |
| `.github/workflows/`                | CI + CD pipelines (see below)                               |
| `netlify.toml`                      | Netlify config (apps/web)                                   |
| `fly.toml`                          | Fly.io config (apps/api)                                    |
| `nx.json`, `tsconfig.base.json`     | Nx workspace configuration                                  |

## CI/CD

| Workflow            | Trigger                          | What it does                                                  |
| ------------------- | -------------------------------- | ------------------------------------------------------------- |
| `ci.yml`            | PR / push to `develop` / `main`  | `nx affected` lint + test + build, Nx cache, npm audit        |
| `cd-web.yml`        | push to `develop` / `main`       | Builds Angular, deploys to **Netlify** (staging ↔ production) |
| `cd-api.yml`        | push to `develop` / `main` / tag | Builds Docker image, pushes to **ghcr.io**, deploys to **Fly.io** + runs migrations |
| `cd-edge.yml`       | tag `v*`                          | Builds signed Android APK, creates GitHub Release            |
| `codeql.yml`        | weekly + PR                       | CodeQL security analysis                                      |
| `dependabot.yml`    | weekly                            | npm + GitHub Actions version bumps                            |

Branch → environment mapping:

- `main`    → **production** (Netlify prod site + Fly.io app `servidorandroid-api`)
- `develop` → **staging**    (Netlify branch deploy + Fly.io app `servidorandroid-api-staging`)
- `feature/*` → PR against `develop`

## Required GitHub / hosting secrets

```
NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID          # Netlify
FLY_API_TOKEN_STAGING, FLY_API_TOKEN_PROD    # Fly.io
ANDROID_KEYSTORE_BASE64,
ANDROID_KEYSTORE_PASSWORD,
ANDROID_KEY_ALIAS,
ANDROID_KEY_PASSWORD                         # APK signing
```

Runtime secrets (used by the deployed API) are configured in `fly.toml` env blocks or set with `flyctl secrets set` — see `infra/env/.env.example` for the full list.

## Tech stack reference

| Concern        | Tool                                          |
| -------------- | --------------------------------------------- |
| Monorepo       | Nx 18, npm 10 workspaces                       |
| Web frontend   | Angular 18, SCSS, Chart.js / Recharts         |
| Backend        | NestJS 10, TypeORM, PostgreSQL 16             |
| Realtime / auth| Supabase (WebSockets, Realtime, Auth)         |
| Streaming      | WebRTC + coturn (TURN/STUN)                   |
| Push           | Firebase Cloud Messaging                      |
| Edge app       | Ionic 7, Angular 18, Capacitor 6, JDK 17      |
| Hosting (web)  | Netlify                                       |
| Hosting (api)  | Fly.io                                        |
| Container reg  | GitHub Container Registry (ghcr.io)           |

## Working with the docs

- The two `.docx` files in the repo root are the **single source of truth** for scope, backlog, and visual design.
- Code style and naming must match the conventions there (Spanish UI copy, `>` command prefixes, retro-telemetry palette, monospaced type).
- See `AGENTS.md` for non-obvious repo-specific rules an AI assistant should know before making changes.