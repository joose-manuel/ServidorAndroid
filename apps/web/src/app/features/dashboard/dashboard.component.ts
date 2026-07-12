import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChartModule } from 'primeng/chart';
import { HudPanelComponent, StatusBadgeComponent } from '@servidor/ui-components';
import { EdgeMetricsSnapshot } from '@servidor/shared-types';
import { ServerConfigService } from '../../core/config/server-config.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';
import { ContentService } from '../../core/content/content.service';

const DASHBOARD_CACHE_PREFIX = 'web_dashboard_cache:';

interface DashboardCache {
  deviceId: string;
  snapshot: EdgeMetricsSnapshot | null;
  timeLabels: string[];
  latencyHistory: number[];
  bandwidthHistory: Array<{ down: number; up: number }>;
  batteryHistory: number[];
  temperatureHistory: Array<number | null>;
  latestCapturedAt: string | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ChartModule, HudPanelComponent, StatusBadgeComponent],
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
            <div class="metric__sub">temperatura {{ snapshot()?.battery?.temperatureC ?? '—' }} °C</div>
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
          <div class="metric__sub">equipo {{ snapshot()?.deviceName ?? 'sin nombre' }}</div>
          <div class="metric__sub">{{ lastError() ?? 'telemetría en vivo desde la API' }}</div>
          <div class="metric__sub">{{ snapshot()?.deviceModel ?? 'modelo sin detectar' }}</div>
        </hud-panel>
      </div>

      <div class="charts">
        <hud-panel title="Latencia histórica">
          <div class="chart-wrap">
            @if (loadingHistory()) {
              <div class="state">cargando histórico…</div>
            } @else {
              <div class="chart-click" (click)="expandChart('latency')">
                <span class="chart-expand-label">expandir</span>
                <p-chart type="line" [data]="latencyChartData()" [options]="compactChartOptions()"
                  [responsive]="true" style="display:block; height:220px">
                </p-chart>
              </div>
            }
          </div>
        </hud-panel>
        <hud-panel title="Ancho de banda">
          <div class="chart-wrap">
            @if (loadingHistory()) {
              <div class="state">cargando histórico…</div>
            } @else {
              <div class="chart-click" (click)="expandChart('bandwidth')">
                <span class="chart-expand-label">expandir</span>
                <p-chart type="line" [data]="bandwidthChartData()" [options]="compactChartOptions()"
                  [responsive]="true" style="display:block; height:220px">
                </p-chart>
              </div>
            }
          </div>
        </hud-panel>
        <hud-panel title="Batería">
          <div class="chart-wrap">
            @if (loadingHistory()) {
              <div class="state">cargando histórico…</div>
            } @else {
              <div class="chart-click" (click)="expandChart('battery')">
                <span class="chart-expand-label">expandir</span>
                <p-chart type="line" [data]="batteryChartData()" [options]="batteryChartOptions()"
                  [responsive]="true" style="display:block; height:220px">
                </p-chart>
              </div>
            }
          </div>
        </hud-panel>
        <hud-panel title="Temperatura">
          <div class="chart-wrap">
            @if (loadingHistory()) {
              <div class="state">cargando temperatura…</div>
            } @else {
              <div class="chart-click" (click)="expandChart('temperature')">
                <span class="chart-expand-label">expandir</span>
                <p-chart type="line" [data]="temperatureChartData()" [options]="compactChartOptions()"
                  [responsive]="true" style="display:block; height:220px">
                </p-chart>
              </div>
            }
          </div>
        </hud-panel>
      </div>

      <!-- Expand chart modal -->
      @if (dialogVisible()) {
        <div class="modal-overlay" (click)="closeDialog()">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <span class="modal-title">{{ dialogTitle() }}</span>
              <button class="modal-close" (click)="closeDialog()">&times;</button>
            </div>
            <div class="modal-body">
              @if (dialogChart() === 'latency') {
                <p-chart type="line" [data]="latencyChartData()" [options]="expandedChartOptions()"
                  [responsive]="true" style="display:block; height:400px">
                </p-chart>
              }
              @if (dialogChart() === 'bandwidth') {
                <p-chart type="line" [data]="bandwidthChartData()" [options]="expandedChartOptions()"
                  [responsive]="true" style="display:block; height:400px">
                </p-chart>
              }
              @if (dialogChart() === 'battery') {
                <p-chart type="line" [data]="batteryChartData()" [options]="expandedBatteryOptions()"
                  [responsive]="true" style="display:block; height:400px">
                </p-chart>
              }
              @if (dialogChart() === 'temperature') {
                <p-chart type="line" [data]="temperatureChartData()" [options]="expandedChartOptions()"
                  [responsive]="true" style="display:block; height:400px">
                </p-chart>
              }
            </div>
          </div>
        </div>
      }
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
    .chart-click {
      position: relative;
      cursor: pointer;
    }
    .chart-expand-label {
      position: absolute;
      top: 4px;
      right: 4px;
      font-size: 9px;
      text-transform: uppercase;
      color: #5c6773;
      background: #0a0e14;
      border: 1px solid #1c2530;
      padding: 2px 6px;
      z-index: 10;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .chart-click:hover .chart-expand-label {
      opacity: 1;
    }
    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .modal-content {
      background: #0a0e14;
      border: 1px solid #1c2530;
      width: 100%;
      max-width: 960px;
      max-height: 90vh;
      overflow: auto;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1c2530;
      padding: 12px 16px;
    }
    .modal-title {
      color: #ff7a1a;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      text-transform: uppercase;
    }
    .modal-close {
      background: none;
      border: 1px solid #1c2530;
      color: #5c6773;
      font-size: 18px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-family: inherit;
    }
    .modal-close:hover {
      color: #d7dee3;
      border-color: #ff7a1a;
    }
    .modal-body {
      padding: 16px;
    }
    .state--warn {
      min-height: 120px;
      color: #ffaa1a;
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly server = inject(ServerConfigService);
  readonly pairing = inject(PairingStoreService);
  readonly content = inject(ContentService);

  readonly snapshot = signal<EdgeMetricsSnapshot | null>(null);
  readonly loadingHistory = signal(true);
  readonly lastError = signal<string | null>(null);
  readonly dialogVisible = signal(false);
  readonly dialogChart = signal<string | null>(null);
  readonly dialogTitle = computed(() => {
    const map: Record<string, string> = {
      latency: 'Latencia histórica',
      bandwidth: 'Ancho de banda',
      battery: 'Batería',
      temperature: 'Temperatura',
    };
    return map[this.dialogChart() ?? ''] ?? '';
  });

  private timer?: ReturnType<typeof setInterval>;
  private healthTimer?: ReturnType<typeof setInterval>;
  private latestCapturedAt: string | null = null;
  private lastHistoryDeviceId: string | null = null;

  private latencyHistory: number[] = [];
  private bandwidthHistory: Array<{ down: number; up: number }> = [];
  private batteryHistory: number[] = [];
  private temperatureHistory: Array<number | null> = [];
  private timeLabels: string[] = [];

  readonly latencyChartData = computed(() => ({
    labels: this.timeLabels,
    datasets: [{
      label: 'ms',
      data: this.latencyHistory,
      borderColor: '#FF7A1A',
      backgroundColor: 'rgba(255,122,26,0.12)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    }],
  }));

  readonly bandwidthChartData = computed(() => ({
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
  }));

  readonly batteryChartData = computed(() => ({
    labels: this.timeLabels,
    datasets: [{
      label: '% batería',
      data: this.batteryHistory,
      borderColor: '#FFD23F',
      backgroundColor: 'rgba(255,210,63,0.12)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    }],
  }));

  readonly temperatureChartData = computed(() => ({
    labels: this.timeLabels,
    datasets: [{
      label: '°C',
      data: this.temperatureHistory,
      borderColor: '#9F7AEA',
      backgroundColor: 'rgba(159,122,234,0.12)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    }],
  }));

  private readonly baseChartOptions = {
    plugins: {
      legend: {
        labels: {
          color: '#5c6773',
          font: { family: 'JetBrains Mono' },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#3a4350', maxTicksLimit: 6, font: { family: 'JetBrains Mono' } },
        grid: { color: '#1c2530' },
      },
      y: {
        ticks: { color: '#3a4350', font: { family: 'JetBrains Mono' } },
        grid: { color: '#1c2530' },
      },
    },
  };

  readonly compactChartOptions = computed(() => ({
    ...this.baseChartOptions,
    maintainAspectRatio: false,
    responsive: true,
  }));

  readonly expandedChartOptions = computed(() => ({
    ...this.baseChartOptions,
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: '#5c6773',
          font: { family: 'JetBrains Mono', size: 14 },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#3a4350', maxTicksLimit: 15, font: { family: 'JetBrains Mono', size: 12 } },
        grid: { color: '#1c2530' },
      },
      y: {
        ticks: { color: '#3a4350', font: { family: 'JetBrains Mono', size: 12 } },
        grid: { color: '#1c2530' },
      },
    },
  }));

  readonly batteryChartOptions = computed(() => ({
    ...this.compactChartOptions(),
    scales: {
      x: {
        ticks: { color: '#3a4350', maxTicksLimit: 6, font: { family: 'JetBrains Mono' } },
        grid: { color: '#1c2530' },
      },
      y: {
        min: 0,
        max: 100,
        ticks: { color: '#3a4350', stepSize: 20, font: { family: 'JetBrains Mono' } },
        grid: { color: '#1c2530' },
      },
    },
  }));

  readonly expandedBatteryOptions = computed(() => ({
    ...this.expandedChartOptions(),
    scales: {
      x: {
        ticks: { color: '#3a4350', maxTicksLimit: 15, font: { family: 'JetBrains Mono', size: 12 } },
        grid: { color: '#1c2530' },
      },
      y: {
        min: 0,
        max: 100,
        ticks: { color: '#3a4350', stepSize: 20, font: { family: 'JetBrains Mono', size: 12 } },
        grid: { color: '#1c2530' },
      },
    },
  }));

  expandChart(type: string): void {
    this.dialogChart.set(type);
    this.dialogVisible.set(true);
  }

  closeDialog(): void {
    this.dialogVisible.set(false);
    this.dialogChart.set(null);
  }

  ngOnInit(): void {
    this.loadCache();
    void this.refreshHistory();
    this.pollCurrent();
    void this.checkServerHealth();
    this.timer = setInterval(() => this.pollCurrent(), 5000);
    this.healthTimer = setInterval(() => void this.checkServerHealth(), 5000);
  }

  private async refreshHistory(): Promise<void> {
    const base = this.server.apiBaseUrl();
    const deviceId = this.pairing.deviceId();
    if (!base || !deviceId) {
      this.lastHistoryDeviceId = null;
      this.clearDashboardState();
      this.loadingHistory.set(false);
      return;
    }

    this.lastHistoryDeviceId = deviceId;
    this.loadingHistory.set(!this.hasCachedState(deviceId));
    this.lastError.set(null);
    this.http
      .get<EdgeMetricsSnapshot[]>(`${base}/metrics/history/${deviceId}?_=${Date.now()}`)
      .subscribe({
        next: (history) => {
          this.replaceHistory(history);
          if (history.length) {
            const latest = history[history.length - 1];
            this.snapshot.set(latest);
            this.latestCapturedAt = latest.capturedAt;
          }
          this.persistCache();
          this.loadingHistory.set(false);
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
      this.loadCache(deviceId);
      void this.refreshHistory();
    }

    this.http
      .get<EdgeMetricsSnapshot | null>(`${base}/metrics/current/${deviceId}?_=${Date.now()}`)
      .subscribe({
        next: (snapshot) => {
          if (!snapshot) {
            this.clearDashboardState();
            this.lastError.set('el backend aún no recibe muestras del edge');
            return;
          }
          this.lastError.set(null);
          this.snapshot.set(snapshot);
          this.pushData(snapshot);
          this.persistCache();
        },
        error: () => {
          this.clearDashboardState();
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
    this.temperatureHistory = history.map((item) => item.battery?.temperatureC ?? null);
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
    this.temperatureHistory = [...this.temperatureHistory, snapshot.battery?.temperatureC ?? null].slice(-30);
  }

  private checkServerHealth(): Promise<void> {
    const base = this.server.apiBaseUrl();
    if (!base) {
      this.clearDashboardCache();
      this.clearDashboardState();
      this.lastError.set('sin servidor configurado');
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.http.get(`${base}/health?_=${Date.now()}`).subscribe({
        next: () => resolve(),
        error: () => {
          this.clearDashboardCache();
          this.clearDashboardState();
          this.lastError.set('sin conexión con el servidor');
          resolve();
        },
      });
    });
  }

  private cacheKey(deviceId: string): string {
    return `${DASHBOARD_CACHE_PREFIX}${deviceId}`;
  }

  private loadCache(deviceId = this.pairing.deviceId()): void {
    if (!deviceId) return;

    try {
      const raw = localStorage.getItem(this.cacheKey(deviceId));
      if (!raw) return;
      const cache = JSON.parse(raw) as DashboardCache;
      this.snapshot.set(cache.snapshot);
      this.timeLabels = cache.timeLabels ?? [];
      this.latencyHistory = cache.latencyHistory ?? [];
      this.bandwidthHistory = cache.bandwidthHistory ?? [];
      this.batteryHistory = cache.batteryHistory ?? [];
      this.temperatureHistory = cache.temperatureHistory ?? [];
      this.latestCapturedAt = cache.latestCapturedAt ?? null;
      this.lastHistoryDeviceId = deviceId;
      this.loadingHistory.set(false);
    } catch {
      localStorage.removeItem(this.cacheKey(deviceId));
    }
  }

  private persistCache(): void {
    const deviceId = this.pairing.deviceId();
    if (!deviceId) return;

    const cache: DashboardCache = {
      deviceId,
      snapshot: this.snapshot(),
      timeLabels: this.timeLabels,
      latencyHistory: this.latencyHistory,
      bandwidthHistory: this.bandwidthHistory,
      batteryHistory: this.batteryHistory,
      temperatureHistory: this.temperatureHistory,
      latestCapturedAt: this.latestCapturedAt,
    };
    localStorage.setItem(this.cacheKey(deviceId), JSON.stringify(cache));
  }

  private clearDashboardCache(): void {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(DASHBOARD_CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }

  private clearDashboardState(): void {
    this.snapshot.set(null);
    this.loadingHistory.set(false);
    this.latestCapturedAt = null;
    this.timeLabels = [];
    this.latencyHistory = [];
    this.bandwidthHistory = [];
    this.batteryHistory = [];
    this.temperatureHistory = [];
  }

  private hasCachedState(deviceId: string): boolean {
    return !!localStorage.getItem(this.cacheKey(deviceId));
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
    if (this.healthTimer) clearInterval(this.healthTimer);
  }
}
