import { Injectable, signal, computed } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export type NetState = 'idle' | 'checking' | 'ok' | 'slow' | 'offline';

export interface NetSample {
  state: NetState;
  latencyMs: number | null;
  target: string;
  measuredAt: number;
  error?: string;
}

const TARGETS = [
  'https://1.1.1.1/cdn-cgi/trace',
  'https://www.google.com/generate_204',
];

@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly _current = signal<NetSample>({
    state: 'idle',
    latencyMs: null,
    target: TARGETS[0],
    measuredAt: 0,
  });
  readonly current = this._current.asReadonly();
  readonly isOnline = computed(
    () => this._current().state === 'ok' || this._current().state === 'slow',
  );
  private timer?: ReturnType<typeof setInterval>;

  start(intervalMs = 10_000): void {
    if (this.timer) return;
    void this.measure();
    this.timer = setInterval(() => void this.measure(), intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async measure(): Promise<NetSample> {
    this._current.update((s) => ({ ...s, state: 'checking' }));
    for (const target of TARGETS) {
      const sample = await this.ping(target);
      if (sample.state === 'ok' || sample.state === 'slow') {
        this._current.set(sample);
        return sample;
      }
    }
    const last = this._current();
    this._current.set({
      state: 'offline',
      latencyMs: null,
      target: TARGETS[0],
      measuredAt: Date.now(),
      error: 'sin respuesta',
    });
    return last;
  }

  private async ping(target: string): Promise<NetSample> {
    const start = Date.now();
    try {
      if (Capacitor.isNativePlatform()) {
        await CapacitorHttp.get({
          url: target,
          connectTimeout: 3000,
          readTimeout: 3000,
          responseType: 'text',
        });
      } else {
        await fetch(target, { method: 'GET', cache: 'no-store', mode: 'no-cors' });
      }
      const latencyMs = Date.now() - start;
      const state: NetState = latencyMs < 200 ? 'ok' : 'slow';
      return { state, latencyMs, target, measuredAt: Date.now() };
    } catch (err) {
      return {
        state: 'offline',
        latencyMs: null,
        target,
        measuredAt: Date.now(),
        error: String(err),
      };
    }
  }
}