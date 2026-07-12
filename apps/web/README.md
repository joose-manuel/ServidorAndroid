# apps/web — Angular 18 admin panel

See `Documentacion_UXUI_Retro.docx` for the visual spec (retro telemetry, dark base, orange accent, monospaced type).

## Develop

```bash
npx nx serve web          # http://localhost:4200
npx nx build web          # production bundle → dist/apps/web
```

## Routing

Lazy-loaded standalone components, one per area of the web admin panel:

| Route        | Feature                                 | Sprint | HU             |
| ------------ | --------------------------------------- | ------ | -------------- |
| `/dashboard` | métricas activas en tiempo real         | 3      | HU-05, 07, 08  |
| `/modem`     | control remoto del módem                | 1      | HU-01, 02, 03  |
| `/audit`     | auditoría de red (ARP/ICMP cada 15 min) | 2      | HU-04, 16      |
| `/camera`    | WebRTC viewer                           | 5      | HU-10, 11, 12  |
| `/intercom`  | audio bidireccional                     | 6      | HU-13, 14      |
| `/alerts`    | centro de alertas (FCM)                 | 3      | HU-09          |
| `/settings`  | ajustes del nodo                        | 7      | HU-15, 16, 17  |

## Environments

| File                                | Used by                                                |
| ----------------------------------- | ------------------------------------------------------ |
| `src/environments/environment.ts`   | `nx serve web` / `nx build web` (development)          |
| `src/environments/environment.staging.ts` | Netlify **staging** branch (`develop`)             |
| `src/environments/environment.prod.ts`    | Netlify **production** branch (`main`)            |

The staging/prod values are baked at build time by Angular's `fileReplacements`.

## Supabase

Browser client is provided via `provideSupabase()` from `src/app/core/supabase/`. The HTTP interceptor in `src/app/core/auth/auth.interceptor.ts` attaches the Supabase access token to every outbound request.

## UI primitives

All shared UI lives in `@servidor/ui/components` (see `libs/ui/components/src/`):

- `<hud-panel>` — corner-bracketed telemetry panel
- `<status-badge>` — ONLINE / STANDBY / REVISAR / OFFLINE badge
- `<cmd-button>` — button with `>` prefix
- `<corner-brackets>` — overlay bracket decoration

Design tokens are in `@servidor/ui/design-tokens` (TS constants + matching SCSS).