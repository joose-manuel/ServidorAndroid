# apps/edge — Ionic 7 + Capacitor 6 (Android)

Edge Node mobile app. Runs on a Samsung S9 repurposed as a 24/7 server.

See `Documentacion_Edge_Node.docx` for the full scope and sprint mapping.

## Develop

```bash
# 1. Browser preview
npx nx serve edge                              # http://localhost:8100

# 2. Build the web bundle and sync it into the Android project
npx nx build edge
npx nx run edge:cap:sync

# 3. Run on a connected device / emulator
npx nx run edge:cap:open:android               # opens Android Studio
```

The `cap:sync` target depends on `edge:build` so a clean build+sync chain is just two commands.

## Features / sprints

| Path          | Component                          | Sprint | HU                       |
| ------------- | ---------------------------------- | ------ | ------------------------ |
| `/boot`       | `boot.component`                   | 4      | HU-06 (foreground service) |
| `/dashboard`  | `dashboard.component`              | 3      | HU-05, HU-07             |
| `/modem`      | `modem-client.component`           | 1      | HU-01, HU-02             |
| `/audit`      | `audit-worker.component`           | 2      | HU-04 (15 min cadence)   |
| `/camera`     | `camera-streamer.component`        | 5      | HU-10, HU-11, HU-12      |
| `/intercom`   | `intercom.component`               | 6      | HU-13, HU-14             |

## Critical implementation notes (from docx 11.x)

- **CORS** — all requests to the modem (`192.168.1.1`) go through `@capacitor/http`, **not** the WebView's `fetch`. See `modem-client.component.ts`.
- **Battery** — keep the S9 plugged in 24/7, but cap charging at 80% (`ForegroundService` keeps the OS from killing the app). Documented in `ForegroundServiceManager`.
- **Network scan** — every 15 minutes; ping every 3 minutes. Do not increase frequency or the modem CPU spikes.
- **WebRTC** — sessions are requested through the API, which returns short-lived TURN credentials (built in `libs/shared/utils`).

## Build / sign / release

GitHub Actions builds the APK on tag `v*`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow decodes `ANDROID_KEYSTORE_BASE64` into `apps/edge/android/app/release.keystore`, runs `assembleRelease`, and attaches the signed APK to a GitHub Release. Required secrets:

- `ANDROID_KEYSTORE_BASE64` — base64 of your `release.keystore`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`