import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'pair',
    loadComponent: () => import('./features/pair/pair.component').then((m) => m.PairComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'modem',
    loadComponent: () => import('./features/modem-control/modem-control.component').then((m) => m.ModemControlComponent),
  },
  {
    path: 'audit',
    loadComponent: () => import('./features/network-audit/network-audit.component').then((m) => m.NetworkAuditComponent),
  },
  {
    path: 'camera',
    loadComponent: () => import('./features/camera/camera.component').then((m) => m.CameraComponent),
  },
  {
    path: 'intercom',
    loadComponent: () => import('./features/intercom/intercom.component').then((m) => m.IntercomComponent),
  },
  {
    path: 'alerts',
    loadComponent: () => import('./features/alerts/alerts.component').then((m) => m.AlertsComponent),
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