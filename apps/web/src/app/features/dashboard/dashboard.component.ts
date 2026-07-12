import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HudPanelComponent, StatusBadgeComponent } from '@servidor/ui-components';
import { HttpClient } from '@angular/common/http';
import { EdgeMetricsSnapshot } from '@servidor/shared-types';
import { ServerConfigService } from '../../core/config/server-config.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, HudPanelComponent, StatusBadgeComponent],
  template: `
    @if (!server.isConfigured()) {
      <div class="bar bar--warn">
        Sin servidor configurado — ir a <a routerLink="/pair">Conectar nodo</a>
      </div>
    }
    @if (server.isConfigured() && !pairing.isPaired()) {
      <div class="bar bar--warn">
        No hay un nodo vinculado todavía — completá el código en <a routerLink="/pair">Vincular nodo</a>
      </div>
    }
    <div class="grid">
      <hud-panel title="Latencia">
        <div class="metric">
          <div class="metric__value">{{ snapshot()?.latency?.latencyMs ?? '—' }} <span class="metric__unit">ms</span></div>
          <div class="metric__sub">target {{ snapshot()?.latency?.target ?? '—' }}</div>
        </div>
      </hud-panel>
      <hud-panel title="Batería Edge">
        <div class="metric">
          <div class="metric__value">{{ snapshot()?.battery?.levelPercent ?? '—' }}<span class="metric__unit">%</span></div>
          <div class="metric__sub">
            {{ snapshot()?.battery?.isCharging ? 'cargando' : 'en red' }}
          </div>
        </div>
      </hud-panel>
      <hud-panel title="Descarga">
        <div class="metric">
          <div class="metric__value">{{ snapshot()?.speedtest?.downloadMbps ?? '—' }} <span class="metric__unit">Mbps</span></div>
          <div class="metric__sub">{{ snapshot()?.speedtest?.measuredAt ? (snapshot()?.speedtest?.measuredAt | date:'HH:mm') : '—' }}</div>
        </div>
      </hud-panel>
      <hud-panel title="Subida / Ping">
        <div class="metric">
          <div class="metric__value">{{ snapshot()?.speedtest?.uploadMbps ?? '—' }} <span class="metric__unit">Mbps</span></div>
          <div class="metric__sub">ping {{ snapshot()?.speedtest?.pingMs ?? '—' }} ms</div>
        </div>
      </hud-panel>
      <hud-panel title="Dispositivos">
        <div class="metric">
          <div class="metric__value">{{ snapshot()?.connectedDevicesCount ?? '—' }}</div>
          <div class="metric__sub">conectados</div>
        </div>
      </hud-panel>
      <hud-panel title="Estado del nodo">
        <status-badge [tone]="snapshot() ? 'online' : 'standby'" />
      </hud-panel>
    </div>
  `,
  styles: [
    `
      .bar {
        padding: 8px 16px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        margin-bottom: 16px;
        border: 1px solid #1c2530;
      }
      .bar--warn {
        background: #3d1a0a;
        color: #ff7a1a;
        border-color: #6a3a1c;
      }
      .bar--warn a { color: #ff7a1a; }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }
      .metric__value { font-size: 32px; color: #ff7a1a; }
      .metric__unit { font-size: 14px; color: #5c6773; }
      .metric__sub {
        color: #5c6773;
        font-size: 12px;
        margin-top: 4px;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly server = inject(ServerConfigService);
  readonly pairing = inject(PairingStoreService);
  readonly snapshot = signal<EdgeMetricsSnapshot | null>(null);
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    const tick = () => {
      const base = this.server.apiBaseUrl();
      const deviceId = this.pairing.deviceId();
      if (!base || !deviceId) return;
      this.http
        .get<EdgeMetricsSnapshot>(`${base}/metrics/current/${deviceId}`)
        .subscribe({ next: (m) => this.snapshot.set(m), error: () => this.snapshot.set(null) });
    };
    tick();
    this.timer = setInterval(tick, 5000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
