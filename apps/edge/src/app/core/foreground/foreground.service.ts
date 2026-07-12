import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorForegroundService } from 'capacitor-foreground-service';

export type ForegroundState = 'idle' | 'starting' | 'running' | 'stopped';

@Injectable({ providedIn: 'root' })
export class ForegroundServiceManager {
  readonly state = signal<ForegroundState>('idle');

  async start(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.state.set('running');
      return;
    }
    this.state.set('starting');
    await CapacitorForegroundService.startService({
      title: 'Edge Node activo',
      description: 'Monitorizando la red local…',
      icon: 'ic_launcher',
    });
    this.state.set('running');
  }

  async stop(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.state.set('stopped');
      return;
    }
    await CapacitorForegroundService.stopService();
    this.state.set('stopped');
  }
}