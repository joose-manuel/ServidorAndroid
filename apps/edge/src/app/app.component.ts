import { Component, OnInit, computed, effect, inject } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiHealthService } from './core/api/api-health.service';
import { RemoteNodeConfigService } from './core/config/remote-node-config.service';
import { MetricsReporterService } from './core/metrics/metrics-reporter.service';
import { NetworkStatusService } from './core/network/network-status.service';
import { PairingStoreService } from './core/pairing/pairing-store.service';
import { EdgeTelemetryService } from './core/telemetry/edge-telemetry.service';

interface NavItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonicModule, RouterOutlet],
  template: `
    <ion-app>
      <ion-header>
        <ion-toolbar color="dark">
          <ion-buttons slot="start">
            @if (showBackButton()) {
              <ion-button fill="clear" (click)="goBack()">
                <ion-icon slot="icon-only" name="arrow-back-outline" />
              </ion-button>
            }
          </ion-buttons>

          <ion-title>
            <div class="shell-title">
              <span class="shell-title__brand">&gt; edge-node</span>
              <span class="shell-title__page">{{ pageTitle() }}</span>
            </div>
          </ion-title>

          <ion-buttons slot="end">
            <ion-button fill="clear" (click)="navigate('/dashboard')">
              <ion-icon slot="icon-only" name="home-outline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>

        @if (showShell()) {
          <ion-toolbar class="shell-toolbar shell-toolbar--status">
            <div class="shell-status">
              <div class="shell-status__item">
                <span class="shell-status__label">Red</span>
                <span class="shell-status__value" [class]="netClass()">{{ netLabel() }}</span>
              </div>
              <div class="shell-status__item">
                <span class="shell-status__label">API</span>
                <span class="shell-status__value" [class]="apiClass()">{{ apiLabel() }}</span>
              </div>
              <div class="shell-status__item">
                <span class="shell-status__label">Batería</span>
                <span class="shell-status__value">{{ telemetry.snapshot().batteryPercent }}%</span>
              </div>
            </div>
          </ion-toolbar>

          <ion-toolbar class="shell-toolbar shell-toolbar--nav">
            <div class="shell-nav">
              @for (item of navItems; track item.path) {
                <button
                  type="button"
                  class="shell-nav__btn"
                  [class.shell-nav__btn--active]="currentPath() === item.path"
                  (click)="navigate(item.path)"
                >
                  {{ item.label }}
                </button>
              }
            </div>
          </ion-toolbar>
        }
      </ion-header>

      <main class="shell-main">
        <router-outlet />
      </main>
    </ion-app>
  `,
  styles: [
    `
      ion-toolbar {
        --background: #05070a;
        --color: #ff7a1a;
      }
      .shell-toolbar {
        --min-height: auto;
      }
      .shell-title {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-family: 'JetBrains Mono', monospace;
      }
      .shell-title__brand {
        color: #ff7a1a;
        font-size: 14px;
      }
      .shell-title__page {
        color: #5c6773;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .shell-status {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        padding: 10px 12px 0;
        background: #05070a;
      }
      .shell-status__item {
        border: 1px solid #1c2530;
        background: #0a0e14;
        padding: 10px;
        font-family: 'JetBrains Mono', monospace;
      }
      .shell-status__label {
        display: block;
        color: #5c6773;
        font-size: 9px;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .shell-status__value {
        color: #d7dee3;
        font-size: 12px;
      }
      .shell-status__value--ok {
        color: #39ff88;
      }
      .shell-status__value--warn {
        color: #ffaa1a;
      }
      .shell-status__value--err {
        color: #ff5b6e;
      }
      .shell-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 12px;
        background: #05070a;
      }
      .shell-nav__btn {
        border: 1px solid #1c2530;
        background: #0a0e14;
        color: #d7dee3;
        padding: 12px 14px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        text-align: center;
        cursor: pointer;
        flex: 1 0 calc(33.333% - 8px);
      }
      .shell-nav__btn--active {
        border-color: #ff7a1a;
        color: #ff7a1a;
      }
      .shell-main {
        min-height: 100%;
        background: #05070a;
      }
      @media (max-width: 640px) {
        .shell-status {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .shell-nav__btn {
          flex-basis: calc(50% - 8px);
        }
      }
    `,
  ],
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly metrics = inject(MetricsReporterService);
  private readonly remoteConfig = inject(RemoteNodeConfigService);
  private readonly pair = inject(PairingStoreService);
  readonly api = inject(ApiHealthService);
  readonly net = inject(NetworkStatusService);
  readonly telemetry = inject(EdgeTelemetryService);

  readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.split('?')[0]),
    ),
    { initialValue: '/dashboard' },
  );

  readonly showShell = computed(() => this.currentPath() !== '/boot');
  readonly showBackButton = computed(
    () => this.currentPath() !== '/boot' && this.currentPath() !== '/dashboard',
  );

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'API', path: '/api-status' },
    { label: 'Latencia', path: '/latency' },
    { label: 'Banda', path: '/bandwidth' },
    { label: 'Batería', path: '/battery' },
    { label: 'Speed', path: '/speedtest' },
    { label: 'Auditoría', path: '/audit' },
    { label: 'Cámara', path: '/camera' },
    { label: 'Intercom', path: '/intercom' },
    { label: 'Módem', path: '/modem' },
    { label: 'Ajustes', path: '/settings' },
  ];

  constructor() {
    effect(() => {
      if (!this.pair.isPaired() && this.currentPath() !== '/boot') {
        void this.router.navigateByUrl('/boot');
      }
    });
  }

  ngOnInit(): void {
    this.telemetry.start();
    this.remoteConfig.start();
    this.metrics.start();
    this.api.start();
  }

  navigate(path: string): void {
    void this.router.navigateByUrl(path);
  }

  goBack(): void {
    void this.router.navigateByUrl('/dashboard');
  }

  pageTitle(): string {
    return this.navItems.find((item) => item.path === this.currentPath())?.label ?? 'Edge';
  }

  netLabel(): string {
    const current = this.net.current();
    if (current.state === 'ok' || current.state === 'slow') return `${current.latencyMs} ms`;
    if (current.state === 'checking') return 'midiendo…';
    if (current.state === 'offline') return 'sin red';
    return '—';
  }

  netClass(): string {
    const state = this.net.current().state;
    if (state === 'ok') return 'shell-status__value--ok';
    if (state === 'slow' || state === 'checking') return 'shell-status__value--warn';
    if (state === 'offline') return 'shell-status__value--err';
    return '';
  }

  apiLabel(): string {
    const state = this.api.snapshot().state;
    if (state === 'online') return `${this.api.snapshot().latencyMs ?? '—'} ms`;
    if (state === 'checking') return 'verificando…';
    if (state === 'offline') return 'sin respuesta';
    return '—';
  }

  apiClass(): string {
    const state = this.api.snapshot().state;
    if (state === 'online') return 'shell-status__value--ok';
    if (state === 'checking') return 'shell-status__value--warn';
    if (state === 'offline') return 'shell-status__value--err';
    return '';
  }
}
