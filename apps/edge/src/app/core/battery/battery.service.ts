import { Injectable, signal } from '@angular/core';

export interface BatteryInfo {
  levelPercent: number;
  isCharging: boolean;
  chargingTime: number | null;
  dischargingTime: number | null;
}

@Injectable({ providedIn: 'root' })
export class BatteryService {
  readonly info = signal<BatteryInfo>({ levelPercent: 100, isCharging: true, chargingTime: null, dischargingTime: null });
  private batteryManager: any = null;

  async start(): Promise<void> {
    try {
      const b = await (navigator as any).getBattery();
      this.batteryManager = b;
      this.update(b);
      b.addEventListener('levelchange', () => this.update(b));
      b.addEventListener('chargingchange', () => this.update(b));
      b.addEventListener('chargingtimechange', () => this.update(b));
      b.addEventListener('dischargingtimechange', () => this.update(b));
    } catch {
      console.warn('[battery] API no disponible');
    }
  }

  private update(b: any): void {
    this.info.set({
      levelPercent: Math.round(b.level * 100),
      isCharging: b.charging,
      chargingTime: b.chargingTime === Infinity ? null : b.chargingTime,
      dischargingTime: b.dischargingTime === Infinity ? null : b.dischargingTime,
    });
  }
}
