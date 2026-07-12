import { Injectable, computed, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { DeviceRuntime } from './device-runtime.plugin';
import { DeviceIdentityService } from './device-identity.service';

const STORAGE_KEY = 'edge_device_profile';

interface StoredDeviceProfile {
  customName?: string;
}

export interface DeviceInfoSnapshot {
  customName: string | null;
  deviceName: string;
  manufacturer: string | null;
  model: string | null;
  temperatureC: number | null;
}

function normalizeName(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

@Injectable({ providedIn: 'root' })
export class DeviceInfoService {
  private readonly customName = signal<string | null>(this.restoreCustomName());
  private readonly manufacturer = signal<string | null>(null);
  private readonly model = signal<string | null>(null);
  private readonly nativeDeviceName = signal<string | null>(null);
  private readonly temperatureC = signal<number | null>(null);
  private timer?: ReturnType<typeof setInterval>;

  readonly current = computed<DeviceInfoSnapshot>(() => {
    const fallbackName = `edge-${this.identity.deviceId().slice(-6)}`;
    return {
      customName: this.customName(),
      deviceName:
        this.customName() ??
        this.nativeDeviceName() ??
        this.model() ??
        fallbackName,
      manufacturer: this.manufacturer(),
      model: this.model(),
      temperatureC: this.temperatureC(),
    };
  });

  constructor(private readonly identity: DeviceIdentityService) {}

  start(intervalMs = 30000): void {
    void this.refresh();
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => void this.refresh(), intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  setCustomName(value: string): void {
    const customName = normalizeName(value);
    this.customName.set(customName);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ customName }));
  }

  async refresh(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        const info = await DeviceRuntime.getInfo();
        this.manufacturer.set(normalizeName(info.manufacturer ?? ''));
        this.model.set(normalizeName(info.model ?? ''));
        this.nativeDeviceName.set(normalizeName(info.deviceName ?? ''));
        this.temperatureC.set(
          typeof info.temperatureC === 'number' ? Math.round(info.temperatureC * 10) / 10 : null,
        );
        return;
      }
    } catch (error) {
      console.warn('[device-info] native info unavailable', error);
    }

    const fallbackName = this.detectBrowserName();
    this.nativeDeviceName.set(fallbackName);
    this.model.set(fallbackName);
    this.manufacturer.set(null);
    this.temperatureC.set(null);
  }

  private restoreCustomName(): string | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as StoredDeviceProfile;
      return normalizeName(parsed.customName ?? '');
    } catch {
      return null;
    }
  }

  private detectBrowserName(): string | null {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platform = nav.userAgentData?.platform ?? navigator.userAgent ?? '';
    return normalizeName(platform);
  }
}
