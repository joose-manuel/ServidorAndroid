# apps/api — NestJS 10 backend

See `Documentacion_Edge_Node.docx` for the full scope (architecture, backlog, security).

## Develop

```bash
# Local DB via Docker (optional)
docker run --name edge-pg -d -p 5432:5432 \
  -e POSTGRES_USER=edge -e POSTGRES_PASSWORD=edge -e POSTGRES_DB=edge_node \
  postgres:16-alpine

cp infra/env/.env.example infra/env/.env
npx nx serve api          # http://localhost:3000/api
```

## Endpoints

| Method | Path                          | Auth | Description                               |
| ------ | ----------------------------- | ---- | ----------------------------------------- |
| GET    | `/api/health`                 | —    | liveness                                  |
| POST   | `/api/auth/login`             | —    | Supabase password login                   |
| POST   | `/api/modem/reboot`           | ✓    | Sprint 1 — HU-02                          |
| POST   | `/api/network-audit/scan`     | ✓    | Sprint 2 — HU-04                          |
| GET    | `/api/metrics/current/:id`    | —    | Sprint 3 — HU-07                          |
| POST   | `/api/metrics/report`         | ✓    | Sprint 3 — Edge node → server             |
| GET    | `/api/alerts`                 | ✓    | Sprint 3 — HU-09                           |
| POST   | `/api/camera/session`         | ✓    | Sprint 5 — HU-10 (returns TURN creds)     |
| POST   | `/api/camera/session/:id/end` | ✓    | Sprint 5 — HU-10                           |
| POST   | `/api/intercom/session`       | ✓    | Sprint 6 — HU-13                           |
| POST   | `/api/intercom/session/:id/mute` | ✓ | Sprint 6 — HU-14                           |
| POST   | `/api/tools/speedtest`        | ✓    | Sprint 7 — HU-15                           |
| GET    | `/api/audit-log`              | ✓    | Sprint 7 — HU-18                           |

WebSocket namespace: `/realtime` (Socket.IO). Join channels via `subscribe` event.

## Migrations

```bash
npx nx run api:migration:run       # apply pending
npx nx run api:migration:revert    # rollback last
npx nx run api:migration:generate  # scaffold a new one (after entity changes)
```

## Deploy

Docker image built from `infra/docker/api.Dockerfile`, deployed to Fly.io via `.github/workflows/cd-api.yml`. See root `README.md` for the full pipeline.