export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertCategory =
  | 'node_offline'
  | 'high_latency'
  | 'unknown_device'
  | 'modem_reboot'
  | 'stream_started'
  | 'stream_ended'
  | 'auth_failed'
  | 'battery_low';

export interface Alert {
  id: string;
  edgeNodeId: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  createdAt: string;
}