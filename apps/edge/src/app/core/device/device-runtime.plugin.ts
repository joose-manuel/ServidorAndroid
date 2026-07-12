import { registerPlugin } from '@capacitor/core';

export interface DeviceRuntimeInfo {
  manufacturer?: string;
  model?: string;
  deviceName?: string;
  temperatureC?: number | null;
}

export interface DeviceRuntimePlugin {
  getInfo(): Promise<DeviceRuntimeInfo>;
}

export const DeviceRuntime = registerPlugin<DeviceRuntimePlugin>('DeviceRuntime');
