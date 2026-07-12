import { Injectable } from '@nestjs/common';

export interface EdgeDevice {
  deviceId: string;
  code: string;
  paired: boolean;
  pairedAt: string | null;
  lastSeen: string;
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
    };
    this.devices.set(deviceId, device);
    return device;
  }

  pair(code: string): EdgeDevice | undefined {
    const device = this.findByCode(code);
    if (!device) return undefined;
    device.paired = true;
    device.pairedAt = new Date().toISOString();
    return device;
  }

  unpair(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    this.devices.delete(deviceId);
    return true;
  }
}

