import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ServerConfigService } from './server-config.service';
import { DeviceIdentityService } from '../device/device-identity.service';
import { DeviceInfoService } from '../device/device-info.service';
import { SpeedTestService } from '../../features/speedtest/speedtest.service';

interface RemoteNodeConfig {
  intervalSec: number;
  durationSec: number;
  scheduledTimeLocal: string | null;
  deviceName: string | null;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class RemoteNodeConfigService {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly deviceIdentity = inject(DeviceIdentityService);
  private readonly deviceInfo = inject(DeviceInfoService);
  private readonly speed = inject(SpeedTestService);
  private timer?: ReturnType<typeof setInterval>;
  private lastAppliedAt: string | null = null;

  start(intervalMs = 10000): void {
    void this.syncNow();
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => void this.syncNow(), intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async syncNow(): Promise<void> {
    const base = this.server.apiBaseUrl();
    const deviceId = this.deviceIdentity.deviceId();
    if (!base || !deviceId) {
      return;
    }

    try {
      const config = await firstValueFrom(
        this.http.get<RemoteNodeConfig>(`${base}/edge/config/${deviceId}?_=${Date.now()}`),
      );
      if (!config || this.lastAppliedAt === config.updatedAt) {
        return;
      }

      this.speed.setConfig({
        intervalSec: config.intervalSec,
        durationSec: config.durationSec,
        scheduledTimeLocal: config.scheduledTimeLocal,
      });
      this.deviceInfo.setCustomName(config.deviceName ?? '');
      this.lastAppliedAt = config.updatedAt;
    } catch (error) {
      console.warn('[remote-node-config] sync failed', error);
    }
  }
}
