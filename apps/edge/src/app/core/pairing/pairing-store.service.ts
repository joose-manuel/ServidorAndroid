import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'edge_paired_device';

@Injectable({ providedIn: 'root' })
export class PairingStoreService {
  readonly deviceId = signal<string | null>(null);
  readonly isPaired = signal(false);

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.deviceId.set(data.deviceId);
        this.isPaired.set(true);
      } catch { }
    }
  }

  setPaired(deviceId: string): void {
    this.deviceId.set(deviceId);
    this.isPaired.set(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ deviceId }));
  }

  clear(): void {
    this.deviceId.set(null);
    this.isPaired.set(false);
    localStorage.removeItem(STORAGE_KEY);
  }
}
