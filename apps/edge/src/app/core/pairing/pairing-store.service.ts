import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { ServerConfigService } from '../config/server-config.service';

const STORAGE_KEY = 'edge_paired_device';

@Injectable({ providedIn: 'root' })
export class PairingStoreService {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);

  readonly deviceId = signal<string | null>(null);
  readonly isPaired = signal(false);

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.deviceId.set(data.deviceId);
        this.isPaired.set(true);
      } catch { }
    }
  }

  setPaired(deviceId: string): void {
    this.deviceId.set(deviceId);
    this.isPaired.set(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ deviceId }));
  }

  clear(): void {
    this.deviceId.set(null);
    this.isPaired.set(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  async unpairFromServer(deviceId = this.deviceId()): Promise<void> {
    const base = this.server.apiBaseUrl();
    if (!base || !deviceId) {
      this.clear();
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        await CapacitorHttp.post({
          url: `${base}/edge/unpair`,
          headers: {
            'Content-Type': 'application/json',
          },
          data: { deviceId },
          connectTimeout: 5000,
          readTimeout: 5000,
          responseType: 'json',
        });
      } else {
        await firstValueFrom(
          this.http.post(`${base}/edge/unpair`, { deviceId }),
        );
      }
    } catch (error) {
      console.warn('[PairingStore] unpair failed', error);
    } finally {
      this.clear();
    }
  }
}
