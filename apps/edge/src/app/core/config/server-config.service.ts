import { Injectable, signal, computed } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'edge_api_base_url';

interface InfoResponse {
  tunnelUrl: string | null;
  tunnelActive: boolean;
  apiPort: number;
  apiVersion: string;
  timestamp: string;
}

function defaultApiUrl(): string {
  return environment.apiBaseUrl;
}

export type DiscoveryState = 'idle' | 'checking' | 'ok' | 'fail';

export interface DiscoveryResult {
  state: DiscoveryState;
  url: string;
  tunnelUrl: string | null;
  latencyMs: number | null;
  error?: string;
  checkedAt: number;
}

@Injectable({ providedIn: 'root' })
export class ServerConfigService {
  private readonly _apiBaseUrl = signal<string>(defaultApiUrl());
  readonly apiBaseUrl = this._apiBaseUrl.asReadonly();
  readonly isConfigured = computed(() => this._apiBaseUrl().length > 0);
  readonly isCustom = computed(() => this._apiBaseUrl() !== defaultApiUrl());
  readonly discovering = signal(false);
  readonly lastDiscovery = signal<DiscoveryResult | null>(null);

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      this._apiBaseUrl.set(this.normalize(saved));
    }
  }

  async setApiBaseUrl(rawUrl: string): Promise<void> {
    const url = this.normalize(rawUrl);
    this._apiBaseUrl.set(url);
    if (url) {
      localStorage.setItem(STORAGE_KEY, url);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  async reset(): Promise<void> {
    this._apiBaseUrl.set(defaultApiUrl());
    localStorage.removeItem(STORAGE_KEY);
  }

  async discover(): Promise<DiscoveryResult | null> {
    const url = this._apiBaseUrl();
    if (!url) return null;
    this.discovering.set(true);
    const result = await this.pingInfo(url);
    this.lastDiscovery.set(result);
    this.discovering.set(false);
    return result;
  }

  private async pingInfo(rawUrl: string): Promise<DiscoveryResult> {
    const url = `${rawUrl.replace(/\/+$/, '')}/info`;
    const start = Date.now();
    try {
      let info: InfoResponse | null = null;
      if (Capacitor.isNativePlatform()) {
        const res = await CapacitorHttp.get({
          url,
          connectTimeout: 4000,
          readTimeout: 4000,
          responseType: 'json',
        });
        info = res.data as InfoResponse;
      } else {
        const res = await fetch(url, { cache: 'no-store' });
        info = (await res.json()) as InfoResponse;
      }
      const latencyMs = Date.now() - start;
      return {
        state: 'ok',
        url,
        tunnelUrl: info?.tunnelUrl ?? null,
        latencyMs,
        checkedAt: Date.now(),
      };
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      return {
        state: 'fail',
        url,
        tunnelUrl: null,
        latencyMs: null,
        error: e?.status
          ? `HTTP ${e.status}`
          : (e?.message ?? 'sin respuesta'),
        checkedAt: Date.now(),
      };
    }
  }

  private normalize(rawUrl: string): string {
    const url = rawUrl.trim();
    if (!url) return '';
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return withScheme.replace(/\/+$/, '');
  }
}
