export type MetricSeverity = 'ok' | 'warning' | 'critical';

export interface LatencyMetric {
  id: string;
  edgeNodeId: string;
  target: string;
  latencyMs: number;
  packetLossPercent: number;
  severity: MetricSeverity;
  measuredAt: string;
}

export interface BandwidthSample {
  id: string;
  edgeNodeId: string;
  deviceId?: string;
  bytesInPerSec: number;
  bytesOutPerSec: number;
  measuredAt: string;
}

export interface BatteryMetric {
  id: string;
  edgeNodeId: string;
  levelPercent: number;
  isCharging: boolean;
  temperatureC?: number;
  chargeLimitPercent?: number;
  measuredAt: string;
}

export interface SpeedtestResult {
  id: string;
  edgeNodeId: string;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  jitterMs?: number;
  measuredAt: string;
}

export interface UptimeRecord {
  date: string;
  uptimePercent: number;
  downtimeMinutes: number;
}

export interface EdgeMetricsSnapshot {
  edgeNodeId: string;
  deviceName?: string;
  deviceModel?: string;
  measurementConfig?: {
    intervalSec?: number;
    durationSec?: number;
    scheduledTimeLocal?: string | null;
  };
  latency?: LatencyMetric;
  bandwidth?: BandwidthSample;
  battery?: BatteryMetric;
  speedtest?: SpeedtestResult;
  connectedDevicesCount: number;
  capturedAt: string;
}
