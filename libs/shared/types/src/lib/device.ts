export type DeviceStatus = 'known' | 'unknown' | 'suspicious' | 'offline';

export interface NetworkDevice {
  id: string;
  ip: string;
  mac: string;
  hostname?: string;
  vendor?: string;
  status: DeviceStatus;
  isWhitelisted: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  bytesIn?: number;
  bytesOut?: number;
}

export interface NetworkScanResult {
  scannedAt: string;
  durationMs: number;
  devices: NetworkDevice[];
  newDevicesCount: number;
}