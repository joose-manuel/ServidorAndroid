import { Injectable, inject, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { ServerConfigService } from '../config/server-config.service';
import { DeviceIdentityService } from '../device/device-identity.service';
import { NetworkStatusService } from '../network/network-status.service';
import { BatteryService } from '../battery/battery.service';
import { SpeedTestService } from '../../features/speedtest/speedtest.service';

@Injectable({ providedIn: 'root' })
export class MetricsReporterService {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly deviceIdentity = inject(DeviceIdentityService);
  private readonly net = inject(NetworkStatusService);
  private readonly battery = inject(BatteryService);
  private readonly injector = inject(Injector);
  private sub?: Subscription;

  start(edgeNodeId = this.deviceIdentity.deviceId(), intervalMs = 15000): void {
    if (this.sub) return;
    void this.sendReport(edgeNodeId);
    this.sub = interval(intervalMs)
      .pipe(
        switchMap(async () => this.sendReport(edgeNodeId)),
      )
      .subscribe();
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private async sendReport(edgeNodeId: string): Promise<unknown | null> {
    const baseUrl = this.server.apiBaseUrl();
    if (!baseUrl) return null;

    let speedService: SpeedTestService | null = null;
    try { speedService = this.injector.get(SpeedTestService); } catch {}

    const speed = speedService?.current() ?? null;
    const netStatus = this.net.current();
    const bat = this.battery.info();

    const payload = {
      edgeNodeId,
      capturedAt: new Date().toISOString(),
      latencyMs: netStatus.state === 'ok' || netStatus.state === 'slow'
        ? netStatus.latencyMs
        : null,
      packetLossPercent: 0,
      batteryLevelPercent: bat.levelPercent,
      isCharging: bat.isCharging,
      connectedDevicesCount: null,
      downloadMbps: speed?.downloadMbps ?? speed?.mbps ?? null,
      uploadMbps: speed?.uploadMbps ?? null,
      pingMs: speed?.pingMs ?? (
        netStatus.state === 'ok' || netStatus.state === 'slow'
          ? netStatus.latencyMs
          : null
      ),
    };

    try {
      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.post({
          url: `${baseUrl}/metrics/report`,
          headers: {
            'Content-Type': 'application/json',
          },
          data: payload,
          connectTimeout: 5000,
          readTimeout: 5000,
          responseType: 'json',
        });
        return response.data;
      }

      return await firstValueFrom(this.http.post(`${baseUrl}/metrics/report`, payload));
    } catch (error) {
      console.error('[MetricsReporter] report failed', error);
      return null;
    }
  }
}
