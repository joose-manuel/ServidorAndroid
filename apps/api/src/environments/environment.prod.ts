import { Environment } from './environment';

export const environment: Environment = {
  production: true,
  port: Number(process.env['API_PORT'] ?? 3000),
  host: process.env['API_HOST'] ?? '0.0.0.0',
  globalPrefix: process.env['API_GLOBAL_PREFIX'] ?? 'api',
  corsOrigins: (process.env['API_CORS_ORIGINS'] ?? 'https://edge-admin.netlify.app').split(','),
  database: {
    host: process.env['DATABASE_HOST'] ?? 'localhost',
    port: Number(process.env['DATABASE_PORT'] ?? 5432),
    username: process.env['DATABASE_USER'] ?? 'edge',
    password: process.env['DATABASE_PASSWORD'] ?? '',
    database: process.env['DATABASE_NAME'] ?? 'edge_node',
  },
  supabase: {
    url: process.env['SUPABASE_URL'] ?? '',
    anonKey: process.env['SUPABASE_ANON_KEY'] ?? '',
    serviceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
    jwtSecret: process.env['SUPABASE_JWT_SECRET'] ?? '',
  },
  modem: {
    defaultIp: process.env['MODEM_DEFAULT_IP'] ?? '192.168.1.1',
    defaultUser: process.env['MODEM_DEFAULT_USER'] ?? 'admin',
    defaultPassword: process.env['MODEM_DEFAULT_PASSWORD'] ?? '',
    requestTimeoutMs: Number(process.env['MODEM_REQUEST_TIMEOUT_MS'] ?? 5000),
  },
  metrics: {
    pingIntervalMs: Number(process.env['METRICS_PING_INTERVAL_MS'] ?? 180000),
    pingTarget: process.env['METRICS_PING_TARGET'] ?? '8.8.8.8',
    latencyAlertMs: Number(process.env['METRICS_LATENCY_ALERT_MS'] ?? 300),
    networkScanIntervalMs: Number(process.env['NETWORK_SCAN_INTERVAL_MS'] ?? 900000),
    networkScanTimeoutMs: Number(process.env['NETWORK_SCAN_TIMEOUT_MS'] ?? 2000),
  },
  turn: {
    serverUrl: process.env['TURN_SERVER_URL'] ?? 'turn:turn.example.com:3478',
    serverDomain: process.env['TURN_SERVER_DOMAIN'] ?? 'turn.example.com',
    sharedSecret: process.env['TURN_SHARED_SECRET'] ?? '',
    credentialTtlSeconds: Number(process.env['TURN_CREDENTIAL_TTL_SECONDS'] ?? 3600),
  },
};