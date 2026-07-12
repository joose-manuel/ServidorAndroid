import { Injectable, computed, signal } from '@angular/core';
import { ApiHealthService } from '../api/api-health.service';
import { BatteryService } from '../battery/battery.service';
import { DeviceInfoService } from '../device/device-info.service';
import { NetworkStatusService } from '../network/network-status.service';
import { SpeedTestService } from '../../features/speedtest/speedtest.service';

const HISTORY_LIMIT = 40;

export interface TelemetrySample {
  capturedAt: number;
  latencyMs: number | null;
  pingMs: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  batteryPercent: number;
  isCharging: boolean;
  temperatureC: number | null;
  connectedDevicesCount: number | null;
  networkState: string;
  apiState: string;
  deviceName: string | null;
  deviceModel: string | null;
}

export interface MetricPoint {
  value: number;
  capturedAt: number;
}

export interface ConnectionProfile {
  effectiveType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
  saveData: boolean | null;
}

function trimHistory(history: MetricPoint[]): MetricPoint[] {
  return history.slice(-HISTORY_LIMIT);
}

@Injectable({ providedIn: 'root' })
export class EdgeTelemetryService {
  readonly snapshot = signal<TelemetrySample>({
    capturedAt: Date.now(),
    latencyMs: null,
    pingMs: null,
    downloadMbps: null,
    uploadMbps: null,
    batteryPercent: 100,
    isCharging: true,
    temperatureC: null,
    connectedDevicesCount: null,
    networkState: 'idle',
    apiState: 'idle',
    deviceName: null,
    deviceModel: null,
  });

  readonly latencyHistory = signal<MetricPoint[]>([]);
  readonly pingHistory = signal<MetricPoint[]>([]);
  readonly downloadHistory = signal<MetricPoint[]>([]);
  readonly uploadHistory = signal<MetricPoint[]>([]);
  readonly batteryHistory = signal<MetricPoint[]>([]);

  readonly batteryLabel = computed(() =>
    this.snapshot().isCharging ? 'cargando' : 'en descarga',
  );
  readonly apiConnected = computed(() => this.api.snapshot().state === 'online');
  readonly connectionProfile = computed<ConnectionProfile>(() => {
    const connection = (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      };
    }).connection;

    return {
      effectiveType: connection?.effectiveType ?? null,
      downlinkMbps: connection?.downlink ?? null,
      rttMs: connection?.rtt ?? null,
      saveData: connection?.saveData ?? null,
    };
  });

  private timer?: ReturnType<typeof setInterval>;
  private readonly connectedDevicesCount = signal<number | null>(null);

  constructor(
    private readonly network: NetworkStatusService,
    private readonly battery: BatteryService,
    private readonly deviceInfo: DeviceInfoService,
    private readonly speedtest: SpeedTestService,
    private readonly api: ApiHealthService,
  ) {}

  start(intervalMs = 3_000): void {
    this.network.start();
    void this.battery.start();
    this.deviceInfo.start();
    void this.speedtest.start().then(() => this.captureNow());
    this.api.start();

    if (this.timer) return;
    this.captureNow();
    this.timer = setInterval(() => this.captureNow(), intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  setConnectedDevicesCount(count: number | null): void {
    this.connectedDevicesCount.set(count);
  }

  private captureNow(): void {
    const now = Date.now();
    const network = this.network.current();
    const battery = this.battery.info();
    const deviceInfo = this.deviceInfo.current();
    const speed = this.speedtest.current();
    const apiSnapshot = this.api.snapshot();
    const connection = this.connectionProfile();

    const latencyMs =
      network.state === 'ok' || network.state === 'slow' ? network.latencyMs : null;
    const pingMs = speed?.pingMs ?? latencyMs ?? null;
    const fallbackDownloadMbps = connection.downlinkMbps ?? null;
    const fallbackUploadMbps =
      fallbackDownloadMbps === null ? null : Math.max(0.1, Math.round(fallbackDownloadMbps * 0.35 * 100) / 100);
    const downloadMbps = speed?.downloadMbps ?? speed?.mbps ?? fallbackDownloadMbps;
    const uploadMbps = speed?.uploadMbps ?? fallbackUploadMbps;

    this.snapshot.set({
      capturedAt: now,
      latencyMs,
      pingMs,
      downloadMbps,
      uploadMbps,
      batteryPercent: battery.levelPercent,
      isCharging: battery.isCharging,
      temperatureC: deviceInfo.temperatureC,
      connectedDevicesCount: this.connectedDevicesCount(),
      networkState: network.state,
      apiState: apiSnapshot.state,
      deviceName: deviceInfo.deviceName,
      deviceModel: deviceInfo.model,
    });

    this.pushPoint(this.latencyHistory, latencyMs, now);
    this.pushPoint(this.pingHistory, pingMs, now);
    this.pushPoint(this.downloadHistory, downloadMbps, now);
    this.pushPoint(this.uploadHistory, uploadMbps, now);
    this.pushPoint(this.batteryHistory, battery.levelPercent, now);
  }

  private pushPoint(
    target: {
      (): MetricPoint[];
      set(value: MetricPoint[]): void;
      update(fn: (current: MetricPoint[]) => MetricPoint[]): void;
    },
    value: number | null,
    capturedAt: number,
  ): void {
    if (value === null || Number.isNaN(value)) return;
    target.update((history) =>
      trimHistory([...history, { value: Math.round(value * 100) / 100, capturedAt }]),
    );
  }
}
