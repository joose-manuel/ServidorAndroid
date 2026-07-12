import { Injectable, signal, computed } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface SpeedSample {
  mbps: number;
  bytesDownloaded: number;
  durationMs: number;
  measuredAt: number;
}

export interface SpeedConfig {
  intervalSec: number;
  durationSec: number;
  targetUrl: string;
}

const DEFAULT_TARGET = 'https://speed.cloudflare.com/__down?bytes=';
const DEFAULT_INTERVAL_SEC = 60;
const DEFAULT_DURATION_SEC = 8;

const STORAGE_KEY = 'edge_speedtest_config';

function defaultConfig(): SpeedConfig {
  return {
    intervalSec: DEFAULT_INTERVAL_SEC,
    durationSec: DEFAULT_DURATION_SEC,
    targetUrl: DEFAULT_TARGET,
  };
}

@Injectable({ providedIn: 'root' })
export class SpeedTestService {
  private readonly _running = signal(false);
  readonly running = this._running.asReadonly();

  private readonly _current = signal<SpeedSample | null>(null);
  readonly current = this._current.asReadonly();

  private readonly _history = signal<SpeedSample[]>([]);
  readonly history = this._history.asReadonly();

  readonly latestMbps = computed(() => this._current()?.mbps ?? null);
  readonly avgMbps = computed(() => {
    const h = this._history();
    if (!h.length) return null;
    return h.reduce((a, b) => a + b.mbps, 0) / h.length;
  });
  readonly peakMbps = computed(() => {
    const h = this._history();
    if (!h.length) return null;
    return Math.max(...h.map((s) => s.mbps));
  });

  private readonly _config = signal<SpeedConfig>(this.loadConfig());
  readonly config = this._config.asReadonly();

  private timer?: ReturnType<typeof setInterval>;
  private inflight = false;

  private loadConfig(): SpeedConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaultConfig(), ...JSON.parse(raw) };
    } catch {}
    return defaultConfig();
  }

  setConfig(patch: Partial<SpeedConfig>): void {
    const next = { ...this._config(), ...patch };
    this._config.set(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async start(): Promise<void> {
    if (this._running()) return;
    this._running.set(true);
    await this.measureOnce();
    const intervalMs = Math.max(5, this._config().intervalSec) * 1000;
    this.timer = setInterval(() => void this.measureOnce(), intervalMs);
  }

  stop(): void {
    if (!this._running()) return;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this._running.set(false);
  }

  clearHistory(): void {
    this._history.set([]);
    this._current.set(null);
  }

  async measureOnce(): Promise<SpeedSample | null> {
    if (this.inflight) {
      console.log('[speedtest] already in flight, skipping');
      return null;
    }
    this.inflight = true;
    console.log('[speedtest] starting measurement');
    const cfg = this._config();
    const targetBytes = Math.max(
      1_000_000,
      Math.round((cfg.durationSec * 5_000_000) / 8),
    );
    const url = `${cfg.targetUrl}${targetBytes}`;
    console.log('[speedtest] downloading', targetBytes, 'bytes from', url);
    try {
      const sample = await this.download(url);
      console.log('[speedtest] success:', sample.mbps, 'Mbps');
      this._current.set(sample);
      this._history.update((h) => [...h.slice(-119), sample]);
      return sample;
    } catch (err) {
      console.warn('[speedtest] failed', err);
      return null;
    } finally {
      this.inflight = false;
    }
  }

  private async download(url: string): Promise<SpeedSample> {
    const start = Date.now();
    const deadline = start + this._config().durationSec * 1000 + 2000;
    let bytes = 0;

    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.get({
        url,
        connectTimeout: 5000,
        readTimeout: this._config().durationSec * 1000 + 5000,
        responseType: 'text',
      });
      const data = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      bytes = data.length;
    } else {
      const res = await fetch(url, { cache: 'no-store' });
      const reader = res.body?.getReader();
      if (reader) {
        while (true) {
          if (Date.now() > deadline) break;
          const { done, value } = await reader.read();
          if (done) break;
          if (value) bytes += value.length;
        }
        try {
          await reader.cancel();
        } catch {}
      } else {
        const text = await res.text();
        bytes = text.length;
      }
    }

    const durationMs = Math.max(1, Date.now() - start);
    const mbps = (bytes * 8) / durationMs / 1000;
    return { mbps: Math.round(mbps * 100) / 100, bytesDownloaded: bytes, durationMs, measuredAt: Date.now() };
  }
}