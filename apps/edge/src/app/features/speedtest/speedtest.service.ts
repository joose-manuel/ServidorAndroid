import { Injectable, signal, computed } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface SpeedSample {
  mbps: number;
  downloadMbps: number | null;
  uploadMbps: number | null;
  pingMs: number | null;
  bytesDownloaded: number;
  bytesUploaded: number;
  durationMs: number;
  measuredAt: number;
}

export interface SpeedConfig {
  intervalSec: number;
  durationSec: number;
  downloadTargetUrl: string;
  uploadTargetUrl: string;
  pingTargetUrl: string;
}

const DEFAULT_DOWNLOAD_TARGET = 'https://speed.cloudflare.com/__down?bytes=';
const DEFAULT_UPLOAD_TARGET = 'https://httpbin.org/post';
const DEFAULT_PING_TARGET = 'https://www.google.com/generate_204';
const DEFAULT_INTERVAL_SEC = 20;
const DEFAULT_DURATION_SEC = 4;

const STORAGE_KEY = 'edge_speedtest_config';

function defaultConfig(): SpeedConfig {
  return {
    intervalSec: DEFAULT_INTERVAL_SEC,
    durationSec: DEFAULT_DURATION_SEC,
    downloadTargetUrl: DEFAULT_DOWNLOAD_TARGET,
    uploadTargetUrl: DEFAULT_UPLOAD_TARGET,
    pingTargetUrl: DEFAULT_PING_TARGET,
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
    try {
      const sample = await this.measureSample(targetBytes);
      console.log('[speedtest] success:', sample.downloadMbps, 'down /', sample.uploadMbps, 'up');
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

  private async measureSample(targetBytes: number): Promise<SpeedSample> {
    const cfg = this._config();
    const downloadUrl = `${cfg.downloadTargetUrl}${targetBytes}`;
    console.log('[speedtest] downloading', targetBytes, 'bytes from', downloadUrl);

    const pingMs = await this.tryMeasurePing(cfg.pingTargetUrl);
    const download = await this.tryDownload(downloadUrl);
    const uploadBytes = Math.max(250_000, Math.round(targetBytes / 2));
    const uploadMbps = await this.tryUpload(cfg.uploadTargetUrl, uploadBytes);

    if (!download && uploadMbps === null && pingMs === null) {
      throw new Error('speedtest failed: no sample could be collected');
    }

    return {
      mbps: download?.mbps ?? 0,
      downloadMbps: download?.mbps ?? null,
      uploadMbps,
      pingMs,
      bytesDownloaded: download?.bytesDownloaded ?? 0,
      bytesUploaded: uploadMbps === null ? 0 : uploadBytes,
      durationMs: download?.durationMs ?? 0,
      measuredAt: Date.now(),
    };
  }

  private async tryMeasurePing(url: string): Promise<number | null> {
    try {
      return await this.measurePing(url);
    } catch (err) {
      console.warn('[speedtest] ping failed', err);
      return null;
    }
  }

  private async tryDownload(
    url: string,
  ): Promise<{ mbps: number; bytesDownloaded: number; durationMs: number } | null> {
    try {
      return await this.download(url);
    } catch (err) {
      console.warn('[speedtest] download failed', err);
      return null;
    }
  }

  private async tryUpload(url: string, bytes: number): Promise<number | null> {
    try {
      return await this.upload(url, bytes);
    } catch (err) {
      console.warn('[speedtest] upload failed', err);
      return null;
    }
  }

  private async measurePing(url: string): Promise<number> {
    const start = Date.now();
    if (Capacitor.isNativePlatform()) {
      await CapacitorHttp.get({
        url,
        connectTimeout: 4000,
        readTimeout: 4000,
        responseType: 'text',
      });
    } else {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`ping failed: HTTP ${res.status}`);
      }
    }
    return Math.max(1, Date.now() - start);
  }

  private async download(url: string): Promise<{
    mbps: number;
    bytesDownloaded: number;
    durationMs: number;
  }> {
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
    return { mbps: Math.round(mbps * 100) / 100, bytesDownloaded: bytes, durationMs };
  }

  private async upload(url: string, bytes: number): Promise<number> {
    const payload = 'x'.repeat(bytes);
    const start = Date.now();

    if (Capacitor.isNativePlatform()) {
      await CapacitorHttp.post({
        url,
        headers: { 'content-type': 'text/plain' },
        data: payload,
        connectTimeout: 5000,
        readTimeout: this._config().durationSec * 1000 + 5000,
        responseType: 'json',
      });
    } else {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: payload,
      });
      if (!res.ok) {
        throw new Error(`upload failed: HTTP ${res.status}`);
      }
    }

    const durationMs = Math.max(1, Date.now() - start);
    return Math.round((((bytes * 8) / durationMs) / 1000) * 100) / 100;
  }
}
