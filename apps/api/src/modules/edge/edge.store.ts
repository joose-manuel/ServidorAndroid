import { Injectable } from '@nestjs/common';

export interface EdgeDevice {
  deviceId: string;
  code: string;
  paired: boolean;
  pairedAt: string | null;
  lastSeen: string;
  measurementConfig: EdgeMeasurementConfig;
}

export interface EdgeMeasurementConfig {
  intervalSec: number;
  durationSec: number;
  scheduledTimeLocal: string | null;
  deviceName: string | null;
  updatedAt: string;
}

function defaultMeasurementConfig(): EdgeMeasurementConfig {
  return {
    intervalSec: 20,
    durationSec: 4,
    scheduledTimeLocal: null,
    deviceName: null,
    updatedAt: new Date().toISOString(),
  };
}

@Injectable()
export class EdgeStore {
  private readonly devices = new Map<string, EdgeDevice>();

  findByCode(code: string): EdgeDevice | undefined {
    for (const device of this.devices.values()) {
      if (device.code === code && !device.paired) return device;
    }
    return undefined;
  }

  findByDeviceId(deviceId: string): EdgeDevice | undefined {
    return this.devices.get(deviceId);
  }

  register(deviceId: string, code: string): EdgeDevice {
    const device: EdgeDevice = {
      deviceId,
      code,
      paired: false,
      pairedAt: null,
      lastSeen: new Date().toISOString(),
      measurementConfig: defaultMeasurementConfig(),
    };
    this.devices.set(deviceId, device);
    return device;
  }

  connect(deviceId: string): EdgeDevice {
    const now = new Date().toISOString();
    const existing = this.devices.get(deviceId);

    if (existing) {
      existing.paired = true;
      existing.pairedAt = now;
      existing.lastSeen = now;
      return existing;
    }

    const device: EdgeDevice = {
      deviceId,
      code: '',
      paired: true,
      pairedAt: now,
      lastSeen: now,
      measurementConfig: defaultMeasurementConfig(),
    };
    this.devices.set(deviceId, device);
    return device;
  }

  pair(code: string): EdgeDevice | undefined {
    const device = this.findByCode(code);
    if (!device) return undefined;
    device.paired = true;
    device.pairedAt = new Date().toISOString();
    device.lastSeen = device.pairedAt;
    return device;
  }

  active(): EdgeDevice | null {
    const pairedDevices = [...this.devices.values()].filter((device) => device.paired);
    if (pairedDevices.length === 0) {
      return null;
    }

    pairedDevices.sort((a, b) => {
      const aTime = Date.parse(a.lastSeen);
      const bTime = Date.parse(b.lastSeen);
      return bTime - aTime;
    });

    return pairedDevices[0];
  }

  unpair(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    this.devices.delete(deviceId);
    return true;
  }

  config(deviceId: string): EdgeMeasurementConfig {
    const existing = this.devices.get(deviceId);
    if (existing) {
      return existing.measurementConfig;
    }

    const created = this.connect(deviceId);
    return created.measurementConfig;
  }

  updateConfig(
    deviceId: string,
    patch: Partial<Omit<EdgeMeasurementConfig, 'updatedAt'>>,
  ): EdgeMeasurementConfig {
    const device = this.devices.get(deviceId) ?? this.connect(deviceId);
    device.measurementConfig = {
      ...device.measurementConfig,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    device.lastSeen = device.measurementConfig.updatedAt;
    return device.measurementConfig;
  }
}
