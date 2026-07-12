import { Injectable, computed, signal } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { ServerConfigService } from '../config/server-config.service';

export type ApiHealthState = 'idle' | 'checking' | 'online' | 'offline';

export interface ApiHealthSnapshot {
  state: ApiHealthState;
  latencyMs: number | null;
  checkedAt: number | null;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiHealthService {
  private readonly _snapshot = signal<ApiHealthSnapshot>({
    state: 'idle',
    latencyMs: null,
    checkedAt: null,
  });
  readonly snapshot = this._snapshot.asReadonly();
  readonly isOnline = computed(() => this._snapshot().state === 'online');

  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly server: ServerConfigService) {}

  start(intervalMs = 15_000): void {
    if (this.timer) return;
    void this.checkNow();
    this.timer = setInterval(() => void this.checkNow(), intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async checkNow(): Promise<ApiHealthSnapshot> {
    const baseUrl = this.server.apiBaseUrl();
    if (!baseUrl) {
      const empty = {
        state: 'offline' as const,
        latencyMs: null,
        checkedAt: Date.now(),
        error: 'sin URL de API',
      };
      this._snapshot.set(empty);
      return empty;
    }

    this._snapshot.update((current) => ({ ...current, state: 'checking' }));
    const url = `${baseUrl.replace(/\/+$/, '')}/health`;
    const startedAt = Date.now();

    try {
      if (Capacitor.isNativePlatform()) {
        await CapacitorHttp.get({
          url,
          connectTimeout: 4000,
          readTimeout: 4000,
          responseType: 'json',
        });
      } else {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      }

      const snapshot = {
        state: 'online' as const,
        latencyMs: Date.now() - startedAt,
        checkedAt: Date.now(),
      };
      this._snapshot.set(snapshot);
      return snapshot;
    } catch (error) {
      const snapshot = {
        state: 'offline' as const,
        latencyMs: null,
        checkedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };
      this._snapshot.set(snapshot);
      return snapshot;
    }
  }
}
