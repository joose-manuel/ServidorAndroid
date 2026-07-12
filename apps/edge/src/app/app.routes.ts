import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'boot',
    loadComponent: () => import('./features/boot/boot.component').then((m) => m.BootComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'api-status',
    loadComponent: () => import('./features/api-status/api-status.component').then((m) => m.ApiStatusComponent),
  },
  {
    path: 'latency',
    loadComponent: () => import('./features/latency/latency.component').then((m) => m.LatencyComponent),
  },
  {
    path: 'bandwidth',
    loadComponent: () => import('./features/bandwidth/bandwidth.component').then((m) => m.BandwidthComponent),
  },
  {
    path: 'battery',
    loadComponent: () => import('./features/battery/battery.component').then((m) => m.BatteryComponent),
  },
  {
    path: 'modem',
    loadComponent: () => import('./features/modem-client/modem-client.component').then((m) => m.ModemClientComponent),
  },
  {
    path: 'audit',
    loadComponent: () => import('./features/audit-worker/audit-worker.component').then((m) => m.AuditWorkerComponent),
  },
  {
    path: 'camera',
    loadComponent: () => import('./features/camera-streamer/camera-streamer.component').then((m) => m.CameraStreamerComponent),
  },
  {
    path: 'intercom',
    loadComponent: () => import('./features/intercom/intercom.component').then((m) => m.IntercomComponent),
  },
  {
    path: 'speedtest',
    loadComponent: () => import('./features/speedtest/speedtest.component').then((m) => m.SpeedtestComponent),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
