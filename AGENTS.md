# AGENTS.md

## What this repo is

Full **Nx monorepo** for the **ServidorAndroid / Edge Node Network Manager**: a Samsung S9 repurposed as a 24/7 Edge server for home-network automation (modem control, LAN audit, real-time metrics, remote camera, two-way audio intercom), with an Angular admin panel and a NestJS backend.

Three Nx apps plus six libraries, all in one repository:

| Path | Tag | Purpose |
| --- | --- | --- |
| `apps/web` | `scope:web` | Angular 18 admin panel → **Netlify** |
| `apps/api` | `scope:api` | NestJS 10 backend → **Fly.io** |
| `apps/edge` | `scope:edge` | Ionic 7 + Capacitor 6 (Android) → signed APK |
| `libs/shared/types` | `scope:shared` | TS interfaces shared by all 3 apps |
| `libs/shared/dto` | `scope:shared` | Request/response shapes |
| `libs/shared/utils` | `scope:shared` | Pure helpers (date, network, crypto, severity) |
| `libs/shared/supabase` | `scope:shared` | Channel/event name constants, config reader |
| `libs/ui/design-tokens` | `scope:ui` | Retro-telemetry TS + SCSS tokens |
| `libs/ui/components` | `scope:ui` | Angular standalone components (`hud-panel`, `status-badge`, `cmd-button`, `corner-brackets`) |

The two `.docx` files in the root remain the **canonical scope and design source of truth** (`Documentacion_Edge_Node.docx` — architecture, backlog, Sprint 0..7; `Documentacion_UXUI_Retro.docx` — visual identity). Do not rewrite them.

## Toolchain (locked by `.nvmrc`)

- **Node 20 LTS** (`.nvmrc`, `package.json` engines)
- **npm 10** workspaces
- **JDK 17** — required by Capacitor Android builds (set up by `cd-edge.yml`)
- **Nx 18** (`@nx/angular`, `@nx/nest`, `@nx/ionic-angular`)

## Most-used commands

These run from the repo root after `npm install` (or `npm ci` for a clean install).

| Command              | What it does                                                 | URL                              |
| -------------------- | ------------------------------------------------------------ | -------------------------------- |
| `npm install`        | Install all monorepo dependencies (npm workspaces + Nx 18)   | —                                |
| `npm run front`      | Run the Angular 18 admin panel                                | http://localhost:4200            |
| `npm run back`       | Run the NestJS 10 API (REST + WebSocket)                      | http://localhost:3000/api        |
| `npm run android`    | Run the Ionic 7 mobile app in the browser                     | http://localhost:8100            |
| `npm run build`      | Build every Nx project that has a `build` target             | `dist/apps/*`                    |
| `npm run build:web`  | Production build of the Angular app                           | `dist/apps/web`                  |
| `npm run build:api`  | Production build of the NestJS API                           | `dist/apps/api`                  |
| `npm run build:edge` | Production build of the Ionic app (assets consumed by Capacitor) | `dist/apps/edge`              |
| `npm run lint`       | Lint every project                                            | —                                |
| `npm run test`       | Run tests on every project                                    | —                                |
| `npm run format`     | Prettier write across the repo                                | —                                |
| `npm run cap:sync`   | Build the web bundle and `npx cap sync android`               | updates `apps/edge/android/`     |
| `npm run migrate:run` / `:revert` / `:generate` | TypeORM migrations via NestJS datasource        | —                                |
| `npm run reset`      | Clear Nx cache                                               | —                                |

Each short alias (`front`, `back`, `android`, `build:web`, `lint:api`, etc.) is a wrapper over `nx <command> <project>`. The full Nx CLI is still available via `npx nx ...` for advanced use (e.g. `nx affected -t lint test build`).

### Why a `.npmrc` exists

`@nx/angular@18.3.0` declares an overly conservative peer range for `@angular-devkit/build-angular` (`>= 15.0.0 < 18.0.0`) even though Angular 18 is supported. The repo ships a `.npmrc` with `legacy-peer-deps=true` so `npm install` just works. If you ever delete `.npmrc`, the equivalent manual command is:

```bash
npm install --legacy-peer-deps
```

## Architecture boundaries (enforced by ESLint)

Defined in `.eslintrc.base.json` via `@nx/enforce-module-boundaries` and `tags`:

- `scope:web` → can depend on `scope:shared`, `scope:ui`, `scope:web`
- `scope:api` → can depend on `scope:shared`, `scope:api`
- `scope:edge` → can depend on `scope:shared`, `scope:ui`, `scope:edge`
- `scope:ui` → can depend on `scope:shared`, `scope:ui`
- `scope:shared` → can only depend on `scope:shared`

If you need to cross these (e.g. `web` reaching into `api`), refactor into a `scope:shared` lib — do not bypass with `eslint-disable`.

## Environment configuration

The single source of variable documentation is `infra/env/.env.example`. Copies:

- `infra/env/.env` — local dev (gitignored)
- `infra/env/.env.staging` — staging secrets (gitignored, baked by `cd-api.yml`)
- `infra/env/.env.prod` — production secrets (gitignored, baked by `cd-api.yml`)

Build-time file replacements for Angular and NestJS swap `environment.ts` → `environment.{staging,prod}.ts`. See `apps/web/project.json` (`configurations.staging`) and `apps/api/project.json`.

Key variables you must not invent defaults for: `SUPABASE_*`, `DATABASE_*`, `TURN_SHARED_SECRET`, `MODEM_DEFAULT_IP` (default `192.168.1.1` per docx).

## Critical implementation rules from the docs

These come straight from `Documentacion_Edge_Node.docx` — they are easy to miss and cause real bugs:

1. **Modem requests from Ionic must use `@capacitor/http`** — the WebView's `fetch` is blocked by CORS against `192.168.1.1`. See `apps/edge/src/app/features/modem-client/`.
2. **Network scan every 15 min, latency ping every 3 min** (`NETWORK_SCAN_INTERVAL_MS=900000`, `METRICS_PING_INTERVAL_MS=180000`). Do not lower these.
3. **Alert if latency > 300 ms** (`METRICS_LATENCY_ALERT_MS=300`).
4. **WebRTC must be E2E-encrypted** (DTLS-SRTP, standard). TURN credentials are short-lived and built in `libs/shared/utils/src/lib/crypto.ts` via HMAC-SHA1.
5. **Battery: cap charge at 80%** when running the S9 24/7.
6. **Audit log every camera / audio session** (HU-18) — see `apps/api/src/modules/audit-log/`.

## CI/CD

| Workflow | Triggers on | Action |
| --- | --- | --- |
| `.github/workflows/ci.yml` | PR + push to `develop`/`main` | `nx affected` lint + test + build, npm audit, Nx cache via `actions/cache` |
| `.github/workflows/cd-web.yml` | push to `develop`/`main` | `nwtgck/actions-netlify@v3.0` to **Netlify** (staging ↔ production) |
| `.github/workflows/cd-api.yml` | push to `develop`/`main` + tag `v*` | Docker → ghcr.io → `flyctl deploy` (canary), runs migrations on prod, smoke-tests `/api/health` |
| `.github/workflows/cd-edge.yml` | tag `v*` | JDK 17 setup, `cap sync`, signs APK, attaches to GitHub Release |
| `.github/workflows/codeql.yml` | weekly + PR | GitHub CodeQL |
| `.github/dependabot.yml` | weekly | npm + GitHub Actions bumps |

### Secrets the deploy workflows need

| Secret | Used by |
| --- | --- |
| `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` | `cd-web.yml` |
| `FLY_API_TOKEN_STAGING`, `FLY_API_TOKEN_PROD` | `cd-api.yml` |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | `cd-edge.yml` |

### Hosting configs

- Web: `netlify.toml` (publish `dist/apps/web/browser`, `/api/*` proxied to Fly.io).
- API: `fly.toml` (Docker image from `infra/docker/api.Dockerfile`, region `mia`, release command runs migrations).

## Style conventions to preserve

- Project voice and UI copy are **Spanish**.
- Visual identity is retro-telemetry / CRT terminal — `libs/ui/design-tokens` is the single source for colors (`#05070A` bg, `#FF7A1A` accent), monospaced type (`JetBrains Mono` / `Space Mono`), `>` command prefixes, corner brackets.
- `tsconfig.base.json` is strict (`strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, etc.) — keep new code compliant.
- All UI libs use **standalone Angular components** with OnPush-style change detection defaults; do not introduce NgModules.
- DTOs live in `libs/shared/dto` and must mirror the request/response bodies used by `apps/api` controllers.

## Things an agent will likely get wrong without this file

- Root scripts **do** exist now (`npm run front`, `back`, `android`, `build`, `lint`, `test`, etc.). Prefer them over raw `npx nx` calls for the common dev loops; reserve `npx nx affected ...` for CI-style invocation.
- The Capacitor Android project (`apps/edge/android/`) is intentionally **not committed**; `npx cap add android` inside `apps/edge/` is part of first-time setup. The CI workflow does not depend on it being present in git.
- `.env`, keystores, and `dist/` are gitignored. Never commit them.
- The two `.docx` files are binary; edit them with a Word-aware tool only.
- Current branch is `develop`. Do not commit directly to `main` — open a PR.