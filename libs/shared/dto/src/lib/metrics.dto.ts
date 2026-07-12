export interface MetricsQueryDto {
  edgeNodeId: string;
  from?: string;
  to?: string;
  intervalSeconds?: number;
}

export interface ReportMetricsDto {
  edgeNodeId: string;
  capturedAt: string;
  latencyMs?: number;
  packetLossPercent?: number;
  batteryLevelPercent?: number;
  isCharging?: boolean;
  temperatureC?: number;
  speedIntervalSec?: number;
  speedDurationSec?: number;
  scheduledTimeLocal?: string | null;
  downloadMbps?: number;
  uploadMbps?: number;
  pingMs?: number;
  bytesInPerSec?: number;
  bytesOutPerSec?: number;
  connectedDevicesCount?: number;
  deviceName?: string;
  deviceModel?: string;
}
