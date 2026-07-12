export type ModemStatus = 'online' | 'rebooting' | 'offline' | 'unknown';

export interface Modem {
  id: string;
  ip: string;
  vendor: string;
  model: string;
  firmwareVersion?: string;
  status: ModemStatus;
  uptimeSeconds?: number;
  lastSeenAt: string;
}

export interface ModemCommandLog {
  id: string;
  command: string;
  status: 'pending' | 'ok' | 'error';
  responseMs?: number;
  errorMessage?: string;
  executedAt: string;
}

export interface ModemCronJob {
  id: string;
  cron: string;
  timezone: string;
  action: 'reboot';
  enabled: boolean;
  nextRunAt?: string;
}