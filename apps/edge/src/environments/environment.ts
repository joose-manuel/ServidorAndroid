import { Capacitor } from '@capacitor/core';

export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  modemDefaultIp: string;
}

// En el navegador → localhost, en Android real → IP local de la compu (mismo WiFi)
const host = Capacitor.isNativePlatform() ? '10.0.2.2' : 'localhost';

export const environment: Environment = {
  production: false,
  apiBaseUrl: `http://${host}:3000/api`,
  modemDefaultIp: '192.168.1.1',
};