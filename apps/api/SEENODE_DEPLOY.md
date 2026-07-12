# Deploy backend en Seenode

## Runtime

- `Node.js`: `20`
- `Install command`: `npm install --legacy-peer-deps`
- `Build command`: dejar vacio
- `Start command`: `npm run start:api:seenode`
- `Puerto expuesto`: `3000`

## Variables de entorno

Pega estas variables primero en Seenode para el backend:

```env
NODE_ENV=production
API_PORT=3000
API_HOST=0.0.0.0
API_GLOBAL_PREFIX=api
API_CORS_ORIGINS=http://localhost:4200,http://localhost:8100
API_LOG_LEVEL=log
SKIP_DATABASE=false

DATABASE_HOST=up-de-fra1-postgresql-3.db.run-on-seenode.com
DATABASE_PORT=11550
DATABASE_USER=db_zp9k6f9ziboy
DATABASE_PASSWORD=vMc8W7AVmlYcBSyh9epH7yxL
DATABASE_NAME=db_zp9k6f9ziboy
DATABASE_SSL=true

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

MODEM_DEFAULT_IP=192.168.1.1
MODEM_DEFAULT_USER=admin
MODEM_DEFAULT_PASSWORD=admin
MODEM_REQUEST_TIMEOUT_MS=5000

METRICS_PING_INTERVAL_MS=180000
METRICS_PING_TARGET=8.8.8.8
NETWORK_SCAN_INTERVAL_MS=900000
NETWORK_SCAN_TIMEOUT_MS=2000
METRICS_LATENCY_ALERT_MS=300

TURN_SERVER_URL=turn:turn.example.com:3478
TURN_SERVER_DOMAIN=turn.example.com
TURN_SHARED_SECRET=change-me
TURN_CREDENTIAL_TTL_SECONDS=3600
STUN_SERVER_URL=stun:stun.l.google.com:19302
```

## Ajuste pendiente cuando exista el frontend

Cuando Seenode te entregue la URL publica del frontend, actualiza:

```env
API_CORS_ORIGINS=https://TU-FRONT.seenode.app,http://localhost:4200,http://localhost:8100
```

## Healthcheck esperado

- `GET /api/health`
