import { Component, inject, signal, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import {
  Router,
  RouterOutlet,
  NavigationEnd,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { MetricsReporterService } from './core/metrics/metrics-reporter.service';
import { TunnelService } from './core/tunnel/tunnel.service';
import { NetworkStatusService } from './core/network/network-status.service';

interface MenuItem {
  label: string;
  icon: string;
  path: string;
  badge?: () => string | null;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonicModule, RouterOutlet],
  template: `
    <ion-app>
      <ion-menu contentId="main" type="overlay" side="start">
        <ion-header>
          <ion-toolbar color="dark">
            <ion-title>
              <span class="brand">&gt; edge-node</span>
            </ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <div class="menu-status">
            <div class="menu-status__row">
              <span class="menu-status__label">srv</span>
              <span class="menu-status__val" [class]="tunnelClass()">
                {{ tunnelLabel() }}
              </span>
            </div>
            <div class="menu-status__row">
              <span class="menu-status__label">net</span>
              <span class="menu-status__val" [class]="netClass()">
                {{ netLabel() }}
              </span>
            </div>
          </div>

          <ion-list lines="none" class="menu-list">
            @for (item of menuItems; track item.path) {
              <ion-item
                button
                [class.menu-item--active]="currentPath() === item.path"
                (click)="navigate(item.path)"
                detail="false"
              >
                <ion-icon [name]="item.icon" slot="start" />
                <ion-label>{{ item.label }}</ion-label>
                @if (item.badge && item.badge()) {
                  <ion-badge slot="end" color="warning">{{ item.badge!() }}</ion-badge>
                }
              </ion-item>
            }
          </ion-list>

          <div class="menu-footer">
            <div class="menu-footer__ver">edge-node v0.1.0</div>
          </div>
        </ion-content>
      </ion-menu>

      <div class="ion-page" id="main">
        <ion-header>
          <ion-toolbar color="dark">
            <ion-buttons slot="start">
              @if (showTabs()) {
                <ion-menu-button />
              }
            </ion-buttons>
            <ion-title>
              <span class="title">&gt; {{ pageTitle() }}</span>
            </ion-title>
          </ion-toolbar>
        </ion-header>

        <ion-content>
          <ion-router-outlet />
        </ion-content>

        @if (showTabs()) {
          <ion-tab-bar slot="bottom">
            <ion-tab-button tab="dashboard" href="/dashboard">
              <ion-icon name="speedometer-outline" />
              <ion-label>Dashboard</ion-label>
            </ion-tab-button>
            <ion-tab-button tab="speedtest" href="/speedtest">
              <ion-icon name="pulse-outline" />
              <ion-label>Speed</ion-label>
            </ion-tab-button>
            <ion-tab-button tab="camera" href="/camera">
              <ion-icon name="videocam-outline" />
              <ion-label>Cámara</ion-label>
            </ion-tab-button>
            <ion-tab-button tab="settings" href="/settings">
              <ion-icon name="settings-outline" />
              <ion-label>Ajustes</ion-label>
            </ion-tab-button>
          </ion-tab-bar>
        }
      </div>
    </ion-app>
  `,
  styles: [
    `
      .brand { color: #ff7a1a; font-family: 'JetBrains Mono', monospace; }
      .title { color: #ff7a1a; font-family: 'JetBrains Mono', monospace; font-size: 14px; }
      .menu-status {
        background: #0a0e14;
        border-bottom: 1px solid #1c2530;
        padding: 12px 16px;
        font-family: 'JetBrains Mono', monospace;
      }
      .menu-status__row {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        padding: 4px 0;
      }
      .menu-status__label { color: #ff7a1a; text-transform: uppercase; letter-spacing: 1px; }
      .menu-status__val { color: #d7dee3; }
      .menu-status__val--ok { color: #39ff88; }
      .menu-status__val--err { color: #ff4444; }
      .menu-status__val--warn { color: #ffaa1a; }
      .menu-list { background: transparent; padding: 8px 0; }
      .menu-item--active {
        --background: #1c2530;
        --color: #ff7a1a;
      }
      .menu-item--active ion-icon { color: #ff7a1a !important; }
      .menu-footer {
        padding: 16px;
        border-top: 1px solid #1c2530;
        margin-top: 16px;
      }
      .menu-footer__ver {
        color: #5c6773;
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        text-align: center;
      }
      ion-menu ion-content { --background: #05070a; }
      ion-toolbar { --background: #05070a; --color: #ff7a1a; }
      ion-tab-bar { --background: #05070a; --color: #5c6773; --color-selected: #ff7a1a; }
    `,
  ],
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly metrics = inject(MetricsReporterService);
  readonly tunnel = inject(TunnelService);
  readonly net = inject(NetworkStatusService);

  readonly menuController = (async () => null) as never;
  readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split('?')[0]),
    ),
    { initialValue: '/' },
  );

  readonly showTabs = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => {
        const url = e.urlAfterRedirects.split('?')[0];
        return url !== '/boot' && url !== '/';
      }),
    ),
    { initialValue: false },
  );

  readonly menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'speedometer-outline', path: '/dashboard' },
    { label: 'Speed test', icon: 'pulse-outline', path: '/speedtest' },
    { label: 'Módem', icon: 'wifi-outline', path: '/modem' },
    { label: 'Cámara', icon: 'videocam-outline', path: '/camera' },
    { label: 'Interfono', icon: 'mic-outline', path: '/intercom' },
    { label: 'Auditoría red', icon: 'scan-outline', path: '/audit' },
    { label: 'Ajustes', icon: 'settings-outline', path: '/settings' },
  ];

  ngOnInit(): void {
    this.metrics.start();
    this.net.start();
  }

  navigate(path: string): void {
    this.router.navigateByUrl(path);
    document.querySelector('ion-menu')?.close();
  }

  pageTitle(): string {
    const p = this.currentPath();
    const item = this.menuItems.find((m) => m.path === p);
    if (item) return item.label.toLowerCase();
    if (p === '/boot') return 'boot';
    return 'edge';
  }

  tunnelLabel(): string {
    const s = this.tunnel.state();
    if (s === 'running') return 'activo';
    if (s === 'starting') return 'arrancando…';
    if (s === 'error') return 'error';
    return 'off';
  }

  tunnelClass(): string {
    const s = this.tunnel.state();
    if (s === 'running') return 'menu-status__val--ok';
    if (s === 'error') return 'menu-status__val--err';
    if (s === 'starting') return 'menu-status__val--warn';
    return '';
  }

  netLabel(): string {
    const c = this.net.current();
    if (c.state === 'ok' || c.state === 'slow') return `${c.latencyMs} ms`;
    if (c.state === 'offline') return 'sin red';
    if (c.state === 'checking') return 'midiendo…';
    return '—';
  }

  netClass(): string {
    const s = this.net.current().state;
    if (s === 'ok') return 'menu-status__val--ok';
    if (s === 'slow' || s === 'checking') return 'menu-status__val--warn';
    if (s === 'offline') return 'menu-status__val--err';
    return '';
  }
}