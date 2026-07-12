import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.servidorandroid.edge',
  appName: 'Edge Node',
  webDir: '../../dist/apps/edge/browser',
  server: {
    androidScheme: 'http'
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    BackgroundMode: {
      title: 'Edge Node activo',
      text: 'Monitorizando la red local…',
      icon: 'ic_launcher',
      color: 'FF7A1A'
    }
  }
};

export default config;
