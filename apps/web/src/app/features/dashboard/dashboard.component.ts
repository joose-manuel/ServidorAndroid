import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HudPanelComponent, StatusBadgeComponent } from '@servidor/ui-components';
import { HttpClient } from '@angular/common/http';
import { EdgeMetricsSnapshot } from '@servidor/shared-types';
import { ServerConfigService } from '../../core/config/server-config.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';
import { ContentService } from '../../core/content/content.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HudPanelComponent, StatusBadgeComponent],
  template: `
    <div class="grid">
      <hud-panel [title]="content.t('dashboard', 'latency', 'Latencia')">
        <div class="metric">
          <div class="metric__value">{{ snapshot()?.latency?.latencyMs ?? '—' }} <span class="metric__unit">{{ content.t('dashboard', 'ms', 'ms') }}</span></div>
          <div class="metric__sub">target {{ snapshot()?.latency?.target ?? '—' }}</div>
        </div>
      </hud-panel>
      <hud-panel [title]="content.t('dashboard', 'battery', 'Batería Edge')">
        <div class="metric">
          <div class="metric__value">{{ snapshot()?.battery?.levelPercent ?? '—' }}<span class="metric__unit">%</span></div>
          <div class="metric__sub">
            {{ snapshot()?.battery?.isCharging ? content.t('dashboard', 'charging', 'cargando') : content.t('dashboard', 'onBattery', 'en red') }}
          </div>
        </div>
      </hud-panel>
      <hud-panel [title]="content.t('dashboard', 'download', 'Descarga')">
        <div class="metric">
          <div class="metric__value">{{ snapshot()?.speedtest?.downloadMbps ?? '—' }} <span class="metric__unit">{{ content.t('dashboard', 'mbps', 'Mbps') }}</span></div>
          <div class="metric__sub">{{ snapshot()?.speedtest?.measuredAt ? (snapshot()?.speedtest?.measuredAt | date:'HH:mm') : '—' }}</div>
        </div>
      </hud-panel>
      <hud-panel [title]="content.t('dashboard', 'uploadPing', 'Subida / Ping')">
        <div class="metric">
          <div class="metric__value">{{ snapshot()?.speedtest?.uploadMbps ?? '—' }} <span class="metric__unit">{{ content.t('dashboard', 'mbps', 'Mbps') }}</span></div>
          <div class="metric__sub">ping {{ snapshot()?.speedtest?.pingMs ?? '—' }} {{ content.t('dashboard', 'ms', 'ms') }}</div>
        </div>
      </hud-panel>
      <hud-panel [title]="content.t('dashboard', 'devices', 'Dispositivos')">
        <div class="metric">
          <div class="metric__value">{{ snapshot()?.connectedDevicesCount ?? '—' }}</div>
          <div class="metric__sub">{{ content.t('dashboard', 'connected', 'conectados') }}</div>
        </div>
      </hud-panel>
      <hud-panel [title]="content.t('dashboard', 'nodeStatus', 'Estado del nodo')">
        <status-badge [tone]="snapshot() ? 'online' : 'standby'" />
      </hud-panel>
    </div>

    <div class="charts">
      <hud-panel title="Latencia histórica">
        <div class="chart-wrap"><canvas #latencyChart></canvas></div>
      </hud-panel>
      <hud-panel title="Ancho de banda">
        <div class="chart-wrap"><canvas #bandwidthChart></canvas></div>
      </hud-panel>
      <hud-panel title="Batería">
        <div class="chart-wrap"><canvas #batteryChart></canvas></div>
      </hud-panel>
    </div>
  `,
  styles: [`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .metric__value { font-size: 32px; color: #ff7a1a; }
    .metric__unit { font-size: 14px; color: #5c6773; }
    .metric__sub {
      color: #5c6773;
      font-size: 12px;
      margin-top: 4px;
    }
    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }
    .chart-wrap {
      padding: 8px 0;
      min-height: 200px;
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly http = inject(HttpClient);
  readonly server = inject(ServerConfigService);
  readonly pairing = inject(PairingStoreService);
  readonly content = inject(ContentService);
  readonly snapshot = signal<EdgeMetricsSnapshot | null>(null);
  private timer?: ReturnType<typeof setInterval>;

  @ViewChild('latencyChart', { static: false }) latencyCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('bandwidthChart', { static: false }) bandwidthCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('batteryChart', { static: false }) batteryCanvas?: ElementRef<HTMLCanvasElement>;

  private latencyChart?: Chart;
  private bandwidthChart?: Chart;
  private batteryChart?: Chart;

  private latencyHistory: number[] = [];
  private bandwidthHistory: { down: number; up: number }[] = [];
  private batteryHistory: number[] = [];
  private timeLabels: string[] = [];

  ngOnInit(): void {
    const tick = () => {
      const base = this.server.apiBaseUrl();
      const deviceId = this.pairing.deviceId();
      if (!base || !deviceId) return;
      this.http
        .get<EdgeMetricsSnapshot>(`${base}/metrics/current/${deviceId}`)
        .subscribe({ next: (m) => { this.snapshot.set(m); this.pushData(m); }, error: () => this.snapshot.set(null) });
    };
    tick();
    this.timer = setInterval(tick, 5000);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initCharts(), 500);
  }

  private pushData(m: EdgeMetricsSnapshot): void {
    const now = new Date().toLocaleTimeString();
    this.timeLabels.push(now);
    if (this.timeLabels.length > 30) this.timeLabels.shift();

    if (m.latency?.latencyMs != null) {
      this.latencyHistory.push(m.latency.latencyMs);
      if (this.latencyHistory.length > 30) this.latencyHistory.shift();
    }

    if (m.speedtest) {
      this.bandwidthHistory.push({ down: m.speedtest.downloadMbps ?? 0, up: m.speedtest.uploadMbps ?? 0 });
      if (this.bandwidthHistory.length > 30) this.bandwidthHistory.shift();
    }

    if (m.battery?.levelPercent != null) {
      this.batteryHistory.push(m.battery.levelPercent);
      if (this.batteryHistory.length > 30) this.batteryHistory.shift();
    }

    this.updateCharts();
  }

  private initCharts(): void {
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#5c6773', font: { family: 'JetBrains Mono' } } } },
      scales: {
        x: { ticks: { color: '#3a4350', maxTicksLimit: 6 }, grid: { color: '#1c2530' } },
        y: { ticks: { color: '#3a4350' }, grid: { color: '#1c2530' } },
      },
    };

    if (this.latencyCanvas) {
      this.latencyChart = new Chart(this.latencyCanvas.nativeElement, {
        type: 'line',
        data: { labels: this.timeLabels, datasets: [{ label: 'ms', data: this.latencyHistory, borderColor: '#FF7A1A', backgroundColor: 'rgba(255,122,26,0.1)', fill: true, tension: 0.3, pointRadius: 2 }] },
        options: chartOptions as any,
      });
    }

    if (this.bandwidthCanvas) {
      this.bandwidthChart = new Chart(this.bandwidthCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: this.timeLabels,
          datasets: [
            { label: 'Descarga Mbps', data: this.bandwidthHistory.map(d => d.down), borderColor: '#41E0D1', backgroundColor: 'rgba(65,224,209,0.1)', fill: true, tension: 0.3, pointRadius: 2 },
            { label: 'Subida Mbps', data: this.bandwidthHistory.map(d => d.up), borderColor: '#39FF88', backgroundColor: 'rgba(57,255,136,0.1)', fill: true, tension: 0.3, pointRadius: 2 },
          ],
        },
        options: chartOptions as any,
      });
    }

    if (this.batteryCanvas) {
      this.batteryChart = new Chart(this.batteryCanvas.nativeElement, {
        type: 'line',
        data: { labels: this.timeLabels, datasets: [{ label: '%', data: this.batteryHistory, borderColor: '#FFD23F', backgroundColor: 'rgba(255,210,63,0.1)', fill: true, tension: 0.3, pointRadius: 2 }] },
        options: chartOptions as any,
      });
    }
  }

  private updateCharts(): void {
    if (this.latencyChart) {
      this.latencyChart.data.labels = this.timeLabels;
      this.latencyChart.data.datasets[0].data = this.latencyHistory;
      this.latencyChart.update('none');
    }
    if (this.bandwidthChart) {
      this.bandwidthChart.data.labels = this.timeLabels;
      this.bandwidthChart.data.datasets[0].data = this.bandwidthHistory.map(d => d.down);
      this.bandwidthChart.data.datasets[1].data = this.bandwidthHistory.map(d => d.up);
      this.bandwidthChart.update('none');
    }
    if (this.batteryChart) {
      this.batteryChart.data.labels = this.timeLabels;
      this.batteryChart.data.datasets[0].data = this.batteryHistory;
      this.batteryChart.update('none');
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.latencyChart?.destroy();
    this.bandwidthChart?.destroy();
    this.batteryChart?.destroy();
  }
}
