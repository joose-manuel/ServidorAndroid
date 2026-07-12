import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ServerConfigService } from '../config/server-config.service';

const STORAGE_KEY = 'edge_paired_device';

interface ActiveEdgeResponse {
  deviceId: string;
  paired: boolean;
  pairedAt: string | null;
  lastSeen: string;
}

@Injectable({ providedIn: 'root' })
export class PairingStoreService {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);

  readonly deviceId = signal<string | null>(null);
  readonly isPaired = signal(false);
  private syncing = false;

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.deviceId.set(data.deviceId);
        this.isPaired.set(true);
      } catch { }
    }

    void this.syncFromBackend();
    setInterval(() => {
      void this.syncFromBackend();
    }, 5000);
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

  async syncFromBackend(): Promise<string | null> {
    if (this.syncing) {
      return this.deviceId();
    }

    const base = this.server.apiBaseUrl();
    if (!base) {
      return this.deviceId();
    }

    this.syncing = true;
    try {
      const active = await firstValueFrom(
        this.http.get<ActiveEdgeResponse | null>(`${base}/edge/active?_=${Date.now()}`),
      );

      if (active?.deviceId) {
        this.setPaired(active.deviceId);
      } else {
        this.clear();
      }

      return this.deviceId();
    } catch {
      return this.deviceId();
    } finally {
      this.syncing = false;
    }
  }
}
