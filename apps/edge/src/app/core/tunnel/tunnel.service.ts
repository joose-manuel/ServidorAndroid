import { Injectable, signal, inject } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface EdgeTunnelPlugin {
  start(options: { port?: number; serviceUrl?: string }): Promise<{ pid: number }>;
  stop(): Promise<void>;
  status(): Promise<{ running: boolean; url: string | null }>;
  getLogs(): Promise<{ logs: string }>;
  addListener(eventName: 'url', listener: (data: { url: string }) => void): Promise<void>;
  addListener(eventName: 'stopped', listener: () => void): Promise<void>;
}

const EdgeTunnel = registerPlugin<EdgeTunnelPlugin>('EdgeTunnel');

export type TunnelState = 'stopped' | 'starting' | 'running' | 'error';

@Injectable({ providedIn: 'root' })
export class TunnelService {
  readonly state = signal<TunnelState>('stopped');
  readonly url = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly supported = signal(Capacitor.isNativePlatform());

  constructor() {
    if (!this.supported()) return;
    void EdgeTunnel.addListener('url', (data) => {
      this.url.set(data.url);
      this.state.set('running');
      this.error.set(null);
    });
    void EdgeTunnel.addListener('stopped', () => {
      this.state.set('stopped');
      this.url.set(null);
    });
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.supported()) return;
    try {
      const s = await EdgeTunnel.status();
      this.state.set(s.running ? 'running' : 'stopped');
      this.url.set(s.url);
    } catch {
      // plugin not available yet
    }
  }

  async start(port = 3000): Promise<void> {
    if (!this.supported()) {
      this.error.set('solo disponible en el APK de Android');
      return;
    }
    this.state.set('starting');
    this.error.set(null);
    this.url.set(null);
    try {
      await EdgeTunnel.start({
        port,
        serviceUrl: `http://localhost:${port}`,
      });
    } catch (e: unknown) {
      this.state.set('error');
      this.error.set(String((e as { message?: string })?.message ?? e));
    }
  }

  async stop(): Promise<void> {
    if (!this.supported()) return;
    try {
      await EdgeTunnel.stop();
      this.state.set('stopped');
      this.url.set(null);
    } catch (e: unknown) {
      this.error.set(String((e as { message?: string })?.message ?? e));
    }
  }

  async copyUrl(): Promise<boolean> {
    const u = this.url();
    if (!u) return false;
    try {
      await navigator.clipboard.writeText(u);
      return true;
    } catch {
      return false;
    }
  }

  async getLogs(): Promise<string> {
    if (!this.supported()) return 'solo disponible en el APK de Android';
    try {
      const result = await EdgeTunnel.getLogs();
      return result.logs;
    } catch {
      return 'error al obtener logs';
    }
  }
}