import { Routes } from '@angular/router';
import { authGuard, redirectIfAuthGuard } from './core/auth/auth.guard';

export const APP_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'login',
    canActivate: [redirectIfAuthGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [redirectIfAuthGuard],
    loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'modem',
    canActivate: [authGuard],
    loadComponent: () => import('./features/modem-control/modem-control.component').then((m) => m.ModemControlComponent),
  },
  {
    path: 'audit',
    canActivate: [authGuard],
    loadComponent: () => import('./features/network-audit/network-audit.component').then((m) => m.NetworkAuditComponent),
  },
  {
    path: 'camera',
    canActivate: [authGuard],
    loadComponent: () => import('./features/camera/camera.component').then((m) => m.CameraComponent),
  },
  {
    path: 'intercom',
    canActivate: [authGuard],
    loadComponent: () => import('./features/intercom/intercom.component').then((m) => m.IntercomComponent),
  },
  {
    path: 'alerts',
    canActivate: [authGuard],
    loadComponent: () => import('./features/alerts/alerts.component').then((m) => m.AlertsComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
