import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'edge_device_identity';

interface StoredDeviceIdentity {
  deviceId: string;
}

function buildDeviceId(): string {
  return `edge-${crypto.randomUUID()}`;
}

@Injectable({ providedIn: 'root' })
export class DeviceIdentityService {
  private readonly _deviceId = signal<string>(this.restoreOrCreate());
  readonly deviceId = this._deviceId.asReadonly();

  private restoreOrCreate(): string {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as StoredDeviceIdentity;
        if (parsed.deviceId?.trim()) {
          return parsed.deviceId.trim();
        }
      } catch {
        // Ignore invalid local state and generate a new id.
      }
    }

    const deviceId = buildDeviceId();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ deviceId }));
    return deviceId;
  }
}
