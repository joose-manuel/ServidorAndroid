export interface Environment {
  production: boolean;
  port: number;
  host: string;
  globalPrefix: string;
  corsOrigins: string[];
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
    jwtSecret: string;
  };
  modem: {
    defaultIp: string;
    defaultUser: string;
    defaultPassword: string;
    requestTimeoutMs: number;
  };
  metrics: {
    pingIntervalMs: number;
    pingTarget: string;
    latencyAlertMs: number;
    networkScanIntervalMs: number;
    networkScanTimeoutMs: number;
  };
  turn: {
    serverUrl: string;
    serverDomain: string;
    sharedSecret: string;
    credentialTtlSeconds: number;
  };
}

function readNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  return raw ? Number(raw) : fallback;
}

function readString(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export const environment: Environment = {
  production: false,
  port: readNumber('API_PORT', 3000),
  host: readString('API_HOST', '0.0.0.0'),
  globalPrefix: readString('API_GLOBAL_PREFIX', 'api'),
  corsOrigins: readString('API_CORS_ORIGINS', 'http://localhost:4200,http://localhost:8100,http://localhost,capacitor://localhost,http://10.0.2.2:8100').split(','),
  database: {
    host: readString('DATABASE_HOST', 'localhost'),
    port: readNumber('DATABASE_PORT', 5432),
    username: readString('DATABASE_USER', 'edge'),
    password: readString('DATABASE_PASSWORD', 'edge'),
    database: readString('DATABASE_NAME', 'edge_node'),
  },
  supabase: {
    url: readString('SUPABASE_URL'),
    anonKey: readString('SUPABASE_ANON_KEY'),
    serviceRoleKey: readString('SUPABASE_SERVICE_ROLE_KEY'),
    jwtSecret: readString('SUPABASE_JWT_SECRET'),
  },
  modem: {
    defaultIp: readString('MODEM_DEFAULT_IP', '192.168.1.1'),
    defaultUser: readString('MODEM_DEFAULT_USER', 'admin'),
    defaultPassword: readString('MODEM_DEFAULT_PASSWORD', 'admin'),
    requestTimeoutMs: readNumber('MODEM_REQUEST_TIMEOUT_MS', 5000),
  },
  metrics: {
    pingIntervalMs: readNumber('METRICS_PING_INTERVAL_MS', 180000),
    pingTarget: readString('METRICS_PING_TARGET', '8.8.8.8'),
    latencyAlertMs: readNumber('METRICS_LATENCY_ALERT_MS', 300),
    networkScanIntervalMs: readNumber('NETWORK_SCAN_INTERVAL_MS', 900000),
    networkScanTimeoutMs: readNumber('NETWORK_SCAN_TIMEOUT_MS', 2000),
  },
  turn: {
    serverUrl: readString('TURN_SERVER_URL', 'turn:localhost:3478'),
    serverDomain: readString('TURN_SERVER_DOMAIN', 'localhost'),
    sharedSecret: readString('TURN_SHARED_SECRET', 'change-me'),
    credentialTtlSeconds: readNumber('TURN_CREDENTIAL_TTL_SECONDS', 3600),
  },
};