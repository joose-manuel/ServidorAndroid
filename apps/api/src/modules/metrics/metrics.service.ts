import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { environment } from '../../environments/environment';
import { randomUUID } from 'crypto';
import { AlertsService } from '../alerts/alerts.service';

interface FlatMetrics {
  edgeNodeId: string;
  capturedAt: string;
  latencyMs?: number;
  packetLossPercent?: number;
  batteryLevelPercent?: number;
  isCharging?: boolean;
  downloadMbps?: number;
  uploadMbps?: number;
  pingMs?: number;
  bytesInPerSec?: number;
  bytesOutPerSec?: number;
  connectedDevicesCount?: number;
  [key: string]: unknown;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly alerts: AlertsService) {}

  private latest = new Map<string, FlatMetrics>();
  private history = new Map<string, FlatMetrics[]>();
  private alertState = new Map<string, { highLatency: boolean; batteryLow: boolean }>();

  ingest(edgeNodeId: string, payload: Record<string, unknown>): void {
    const entry = { ...payload, capturedAt: new Date().toISOString() } as FlatMetrics;
    this.latest.set(edgeNodeId, entry);
    const history = [...(this.history.get(edgeNodeId) ?? []), entry].slice(-30);
    this.history.set(edgeNodeId, history);
    this.maybeAlert(edgeNodeId, entry);
  }

  current(edgeNodeId: string): unknown | null {
    const raw = this.latest.get(edgeNodeId);
    if (!raw) return null;
    return this.toSnapshot(edgeNodeId, raw);
  }

  historyFor(edgeNodeId: string): unknown[] {
    return (this.history.get(edgeNodeId) ?? []).map((entry) => this.toSnapshot(edgeNodeId, entry));
  }

  private toSnapshot(edgeNodeId: string, raw: FlatMetrics): unknown {
    const capturedAt = raw.capturedAt ?? new Date().toISOString();
    const downloadMbps = raw.downloadMbps ?? null;
    const uploadMbps = raw.uploadMbps ?? null;
    const pingMs = raw.pingMs ?? raw.latencyMs ?? null;
    const bytesInPerSec =
      raw.bytesInPerSec ?? (downloadMbps === null ? null : Math.round(downloadMbps * 125_000));
    const bytesOutPerSec =
      raw.bytesOutPerSec ?? (uploadMbps === null ? null : Math.round(uploadMbps * 125_000));

    return {
      edgeNodeId: raw.edgeNodeId ?? edgeNodeId,
      capturedAt,
      connectedDevicesCount: raw.connectedDevicesCount ?? 0,
      latency: {
        id: `${edgeNodeId}:${capturedAt}:latency`,
        edgeNodeId,
        latencyMs: raw.latencyMs ?? 0,
        packetLossPercent: raw.packetLossPercent ?? 0,
        target: environment.metrics.pingTarget,
        severity: raw.latencyMs && raw.latencyMs > environment.metrics.latencyAlertMs ? 'critical' : 'ok',
        measuredAt: capturedAt,
      },
      bandwidth: {
        id: `${edgeNodeId}:${capturedAt}:bandwidth`,
        edgeNodeId,
        bytesInPerSec: bytesInPerSec ?? 0,
        bytesOutPerSec: bytesOutPerSec ?? 0,
        measuredAt: capturedAt,
      },
      battery: {
        id: `${edgeNodeId}:${capturedAt}:battery`,
        edgeNodeId,
        levelPercent: raw.batteryLevelPercent ?? 0,
        isCharging: raw.isCharging ?? false,
        measuredAt: capturedAt,
      },
      speedtest: {
        id: `${edgeNodeId}:${capturedAt}:speedtest`,
        edgeNodeId,
        downloadMbps: downloadMbps ?? 0,
        uploadMbps: uploadMbps ?? 0,
        pingMs: pingMs ?? 0,
        measuredAt: capturedAt,
      },
    };
  }

  private maybeAlert(edgeNodeId: string, raw: FlatMetrics): void {
    const previous = this.alertState.get(edgeNodeId) ?? {
      highLatency: false,
      batteryLow: false,
    };
    const next = {
      highLatency: (raw.latencyMs ?? 0) > environment.metrics.latencyAlertMs,
      batteryLow: (raw.batteryLevelPercent ?? 100) <= 20,
    };

    if (next.highLatency && !previous.highLatency) {
      this.alerts.push({
        id: randomUUID(),
        edgeNodeId,
        category: 'high_latency',
        severity: 'critical',
        title: 'Latencia alta detectada',
        message: `El nodo reporto ${raw.latencyMs ?? '—'} ms hacia ${environment.metrics.pingTarget}.`,
        metadata: { latencyMs: raw.latencyMs ?? null },
        createdAt: new Date().toISOString(),
      });
    }

    if (next.batteryLow && !previous.batteryLow) {
      this.alerts.push({
        id: randomUUID(),
        edgeNodeId,
        category: 'battery_low',
        severity: 'warning',
        title: 'Bateria baja en el edge',
        message: `La bateria descendio a ${raw.batteryLevelPercent ?? '—'}%.`,
        metadata: { batteryLevelPercent: raw.batteryLevelPercent ?? null },
        createdAt: new Date().toISOString(),
      });
    }

    this.alertState.set(edgeNodeId, next);
  }

  @Cron(`*/${Math.max(1, Math.round(environment.metrics.pingIntervalMs / 60000))} * * * *`, {
    name: 'edge-ping',
  })
  scheduledPing(): void {
    this.logger.debug(`Scheduled ping → ${environment.metrics.pingTarget}`);
  }
}
