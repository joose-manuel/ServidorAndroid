import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'web_api_base_url';

interface InfoResponse {
  apiPort: number;
  apiVersion: string;
  timestamp: string;
}

export type DiscoveryState = 'idle' | 'checking' | 'ok' | 'fail';

export interface DiscoveryResult {
  state: DiscoveryState;
  url: string;
  latencyMs: number | null;
  error?: string;
  checkedAt: number;
}

@Injectable({ providedIn: 'root' })
export class ServerConfigService {
  private readonly http = inject(HttpClient);

  private readonly _apiBaseUrl = signal<string>(environment.apiBaseUrl);
  readonly apiBaseUrl = this._apiBaseUrl.asReadonly();
  readonly isConfigured = computed(() => this._apiBaseUrl().length > 0);
  readonly isCustom = computed(
    () => this._apiBaseUrl() !== environment.apiBaseUrl,
  );
  readonly discovering = signal(false);
  readonly lastDiscovery = signal<DiscoveryResult | null>(null);

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      this._apiBaseUrl.set(this.normalize(saved));
    }
    console.log(`[ServerConfig] apiBaseUrl = ${this._apiBaseUrl()}${saved ? ' (from localStorage)' : ' (default)'}`);
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
    this._apiBaseUrl.set(environment.apiBaseUrl);
    localStorage.removeItem(STORAGE_KEY);
  }

  async autoDiscover(): Promise<DiscoveryResult | null> {
    try {
      return await this.discover();
    } catch {
      return null;
    }
  }

  async discover(): Promise<DiscoveryResult | null> {
    this.discovering.set(true);
    try {
      const raw = this._apiBaseUrl();
      if (!raw) return null;
      const url = `${raw.replace(/\/+$/, '')}/info`;
      const start = Date.now();
      const res = await fetch(url, { cache: 'no-store' });
      const info = (await res.json()) as InfoResponse;
      const latencyMs = Date.now() - start;
      const result: DiscoveryResult = {
        state: 'ok',
        url,
        latencyMs,
        checkedAt: Date.now(),
      };
      this.lastDiscovery.set(result);
      return result;
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      const result: DiscoveryResult = {
        state: 'fail',
        url: this._apiBaseUrl(),
        latencyMs: null,
        error: e?.status ? `HTTP ${e.status}` : (e?.message ?? 'sin respuesta'),
        checkedAt: Date.now(),
      };
      this.lastDiscovery.set(result);
      return result;
    } finally {
      this.discovering.set(false);
    }
  }

  private normalize(rawUrl: string): string {
    const url = rawUrl.trim();
    if (!url) return environment.apiBaseUrl;
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return withScheme.replace(/\/+$/, '');
  }
}
