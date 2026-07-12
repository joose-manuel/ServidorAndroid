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
  bytesInPerSec?: number;
  bytesOutPerSec?: number;
  connectedDevicesCount?: number;
}