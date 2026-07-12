export type AuditEventType =
  | 'camera_started'
  | 'camera_ended'
  | 'intercom_started'
  | 'intercom_ended'
  | 'modem_reboot'
  | 'modem_login'
  | 'login_success'
  | 'login_failure'
  | 'settings_changed';

export interface AuditLogEntry {
  id: string;
  edgeNodeId?: string;
  userId?: string;
  event: AuditEventType;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}