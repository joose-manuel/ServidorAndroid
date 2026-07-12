import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { environment } from '../../environments/environment';

interface FlatMetrics {
  edgeNodeId: string;
  capturedAt: string;
  latencyMs?: number;
  packetLossPercent?: number;
  batteryLevelPercent?: number;
  isCharging?: boolean;
  connectedDevicesCount?: number;
  [key: string]: unknown;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private latest = new Map<string, FlatMetrics>();

  ingest(edgeNodeId: string, payload: Record<string, unknown>): void {
    this.latest.set(edgeNodeId, { ...payload, capturedAt: new Date().toISOString() } as FlatMetrics);
  }

  current(edgeNodeId: string): unknown | null {
    const raw = this.latest.get(edgeNodeId);
    if (!raw) return null;

    return {
      edgeNodeId: raw.edgeNodeId ?? edgeNodeId,
      capturedAt: raw.capturedAt,
      connectedDevicesCount: raw.connectedDevicesCount ?? 0,
      latency: {
        latencyMs: raw.latencyMs ?? 0,
        packetLossPercent: raw.packetLossPercent ?? 0,
        target: environment.metrics.pingTarget,
        severity: raw.latencyMs && raw.latencyMs > environment.metrics.latencyAlertMs ? 'critical' : 'ok',
        measuredAt: raw.capturedAt,
      },
      battery: {
        levelPercent: raw.batteryLevelPercent ?? 0,
        isCharging: raw.isCharging ?? false,
        measuredAt: raw.capturedAt,
      },
    };
  }

  @Cron(`*/${Math.max(1, Math.round(environment.metrics.pingIntervalMs / 60000))} * * * *`, {
    name: 'edge-ping',
  })
  scheduledPing(): void {
    this.logger.debug(`Scheduled ping → ${environment.metrics.pingTarget}`);
  }
}