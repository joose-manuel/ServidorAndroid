import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { HudPanelComponent, StatusBadgeComponent } from '@servidor/ui-components';
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
    @if (!pairing.deviceId()) {
      <hud-panel title="Dashboard">
        <div class="state state--warn">
          Empareja primero la web con el Android para consultar las métricas del nodo.
        </div>
      </hud-panel>
    } @else {
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
              {{ snapshot()?.battery?.isCharging ? content.t('dashboard', 'charging', 'cargando') : content.t('dashboard', 'onBattery', 'en batería') }}
            </div>
          </div>
        </hud-panel>
        <hud-panel [title]="content.t('dashboard', 'download', 'Descarga')">
          <div class="metric">
            <div class="metric__value">{{ snapshot()?.speedtest?.downloadMbps ?? '—' }} <span class="metric__unit">{{ content.t('dashboard', 'mbps', 'Mbps') }}</span></div>
            <div class="metric__sub">{{ snapshot()?.speedtest?.measuredAt ? (snapshot()?.speedtest?.measuredAt | date:'HH:mm:ss') : 'sin muestra' }}</div>
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
          <div class="metric__sub">{{ lastError() ?? 'telemetría en vivo desde la API' }}</div>
        </hud-panel>
      </div>

      <div class="charts">
        <hud-panel title="Latencia histórica">
          <div class="chart-wrap">
            @if (loadingHistory()) {
              <div class="state">cargando histórico…</div>
            } @else {
              <canvas #latencyChart></canvas>
            }
          </div>
        </hud-panel>
        <hud-panel title="Ancho de banda">
          <div class="chart-wrap">
            @if (loadingHistory()) {
              <div class="state">cargando histórico…</div>
            } @else {
              <canvas #bandwidthChart></canvas>
            }
          </div>
        </hud-panel>
        <hud-panel title="Batería">
          <div class="chart-wrap">
            @if (loadingHistory()) {
              <div class="state">cargando histórico…</div>
            } @else {
              <canvas #batteryChart></canvas>
            }
          </div>
        </hud-panel>
      </div>
    }
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
      min-height: 220px;
    }
    .state {
      min-height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #5c6773;
      border: 1px dashed #1c2530;
      background: #05070a;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      text-align: center;
      padding: 16px;
    }
    .state--warn {
      min-height: 120px;
      color: #ffaa1a;
    }
  `],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly server = inject(ServerConfigService);
  readonly pairing = inject(PairingStoreService);
  readonly content = inject(ContentService);

  readonly snapshot = signal<EdgeMetricsSnapshot | null>(null);
  readonly loadingHistory = signal(true);
  readonly lastError = signal<string | null>(null);

  private timer?: ReturnType<typeof setInterval>;
  private chartsReady = false;
  private latestCapturedAt: string | null = null;
  private lastHistoryDeviceId: string | null = null;

  @ViewChild('latencyChart') latencyCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('bandwidthChart') bandwidthCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('batteryChart') batteryCanvas?: ElementRef<HTMLCanvasElement>;

  private latencyChart?: Chart;
  private bandwidthChart?: Chart;
  private batteryChart?: Chart;

  private latencyHistory: number[] = [];
  private bandwidthHistory: Array<{ down: number; up: number }> = [];
  private batteryHistory: number[] = [];
  private timeLabels: string[] = [];

  ngOnInit(): void {
    void this.refreshHistory();
    this.pollCurrent();
    this.timer = setInterval(() => this.pollCurrent(), 5000);
  }

  ngAfterViewInit(): void {
    this.chartsReady = true;
    this.initCharts();
    this.updateCharts();
  }

  private async refreshHistory(): Promise<void> {
    const base = this.server.apiBaseUrl();
    const deviceId = this.pairing.deviceId();
    if (!base || !deviceId) {
      this.lastHistoryDeviceId = null;
      this.loadingHistory.set(false);
      return;
    }

    this.lastHistoryDeviceId = deviceId;
    this.loadingHistory.set(true);
    this.lastError.set(null);
    this.http
      .get<EdgeMetricsSnapshot[]>(`${base}/metrics/history/${deviceId}`)
      .subscribe({
        next: (history) => {
          this.replaceHistory(history);
          if (history.length) {
            const latest = history[history.length - 1];
            this.snapshot.set(latest);
            this.latestCapturedAt = latest.capturedAt;
          }
          this.loadingHistory.set(false);
          this.updateCharts();
        },
        error: () => {
          this.loadingHistory.set(false);
          this.lastError.set('no se pudo cargar el histórico');
        },
      });
  }

  private pollCurrent(): void {
    const base = this.server.apiBaseUrl();
    const deviceId = this.pairing.deviceId();
    if (!base || !deviceId) return;
    if (deviceId !== this.lastHistoryDeviceId) {
      void this.refreshHistory();
    }

    this.http
      .get<EdgeMetricsSnapshot | null>(`${base}/metrics/current/${deviceId}`)
      .subscribe({
        next: (snapshot) => {
          if (!snapshot) {
            this.snapshot.set(null);
            this.lastError.set('el backend aún no recibe muestras del edge');
            return;
          }
          this.lastError.set(null);
          this.snapshot.set(snapshot);
          this.pushData(snapshot);
        },
        error: () => {
          this.snapshot.set(null);
          this.lastError.set('no se pudo consultar /metrics/current');
        },
      });
  }

  private replaceHistory(history: EdgeMetricsSnapshot[]): void {
    this.timeLabels = history.map((item) => this.formatTime(item.capturedAt));
    this.latencyHistory = history.map((item) => item.latency?.latencyMs ?? 0);
    this.bandwidthHistory = history.map((item) => ({
      down: item.speedtest?.downloadMbps ?? 0,
      up: item.speedtest?.uploadMbps ?? 0,
    }));
    this.batteryHistory = history.map((item) => item.battery?.levelPercent ?? 0);
  }

  private pushData(snapshot: EdgeMetricsSnapshot): void {
    if (this.latestCapturedAt === snapshot.capturedAt) return;
    this.latestCapturedAt = snapshot.capturedAt;

    this.timeLabels = [...this.timeLabels, this.formatTime(snapshot.capturedAt)].slice(-30);
    this.latencyHistory = [...this.latencyHistory, snapshot.latency?.latencyMs ?? 0].slice(-30);
    this.bandwidthHistory = [
      ...this.bandwidthHistory,
      {
        down: snapshot.speedtest?.downloadMbps ?? 0,
        up: snapshot.speedtest?.uploadMbps ?? 0,
      },
    ].slice(-30);
    this.batteryHistory = [...this.batteryHistory, snapshot.battery?.levelPercent ?? 0].slice(-30);
    this.updateCharts();
  }

  private initCharts(): void {
    if (!this.chartsReady) return;

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#5c6773',
            font: { family: 'JetBrains Mono' },
          },
        },
      },
      scales: {
        x: { ticks: { color: '#3a4350', maxTicksLimit: 6 }, grid: { color: '#1c2530' } },
        y: { ticks: { color: '#3a4350' }, grid: { color: '#1c2530' } },
      },
    };

    if (this.latencyCanvas && !this.latencyChart) {
      this.latencyChart = new Chart(this.latencyCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: this.timeLabels,
          datasets: [
            {
              label: 'ms',
              data: this.latencyHistory,
              borderColor: '#FF7A1A',
              backgroundColor: 'rgba(255,122,26,0.12)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
            },
          ],
        },
        options: chartOptions as never,
      });
    }

    if (this.bandwidthCanvas && !this.bandwidthChart) {
      this.bandwidthChart = new Chart(this.bandwidthCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: this.timeLabels,
          datasets: [
            {
              label: 'Descarga Mbps',
              data: this.bandwidthHistory.map((item) => item.down),
              borderColor: '#41E0D1',
              backgroundColor: 'rgba(65,224,209,0.12)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
            },
            {
              label: 'Subida Mbps',
              data: this.bandwidthHistory.map((item) => item.up),
              borderColor: '#39FF88',
              backgroundColor: 'rgba(57,255,136,0.12)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
            },
          ],
        },
        options: chartOptions as never,
      });
    }

    if (this.batteryCanvas && !this.batteryChart) {
      this.batteryChart = new Chart(this.batteryCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: this.timeLabels,
          datasets: [
            {
              label: '% batería',
              data: this.batteryHistory,
              borderColor: '#FFD23F',
              backgroundColor: 'rgba(255,210,63,0.12)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
            },
          ],
        },
        options: chartOptions as never,
      });
    }
  }

  private updateCharts(): void {
    this.initCharts();
    if (this.latencyChart) {
      this.latencyChart.data.labels = this.timeLabels;
      this.latencyChart.data.datasets[0].data = this.latencyHistory;
      this.latencyChart.update('none');
    }
    if (this.bandwidthChart) {
      this.bandwidthChart.data.labels = this.timeLabels;
      this.bandwidthChart.data.datasets[0].data = this.bandwidthHistory.map((item) => item.down);
      this.bandwidthChart.data.datasets[1].data = this.bandwidthHistory.map((item) => item.up);
      this.bandwidthChart.update('none');
    }
    if (this.batteryChart) {
      this.batteryChart.data.labels = this.timeLabels;
      this.batteryChart.data.datasets[0].data = this.batteryHistory;
      this.batteryChart.update('none');
    }
  }

  private formatTime(value: string): string {
    return new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.latencyChart?.destroy();
    this.bandwidthChart?.destroy();
    this.batteryChart?.destroy();
  }
}
