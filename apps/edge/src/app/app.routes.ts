import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'boot' },
  {
    path: 'boot',
    loadComponent: () => import('./features/boot/boot.component').then((m) => m.BootComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
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
];