import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { ApiHealthService } from '../../core/api/api-health.service';
import { DeviceInfoService } from '../../core/device/device-info.service';
import { DeviceIdentityService } from '../../core/device/device-identity.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';
import {
  ConnectionProfile,
  EdgeTelemetryService,
} from '../../core/telemetry/edge-telemetry.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ChartModule],
  template: `
    <div class="dash">
      <header class="dash__hero">
        <div>
          <p class="dash__eyebrow">telemetría del dispositivo edge</p>
          <h1 class="dash__title">Dashboard de monitoreo</h1>
          <p class="dash__subtitle">
            El Android toma las muestras locales de red, batería y ancho de banda en tiempo real.
          </p>
        </div>
        <div class="dash__hero-status">
          <span class="dash__badge" [class]="apiBadgeClass()">{{ apiBadgeLabel() }}</span>
          <span class="dash__timestamp">última muestra {{ sampledAtLabel() }}</span>
        </div>
      </header>

      <section class="dash__summary">
        <article class="summary-card summary-card--accent">
          <span class="summary-card__label">Latencia</span>
          <strong class="summary-card__value">{{ telemetry.snapshot().latencyMs ?? '—' }}</strong>
          <span class="summary-card__unit">ms</span>
        </article>
        <article class="summary-card summary-card--cyan">
          <span class="summary-card__label">Descarga</span>
          <strong class="summary-card__value">{{ telemetry.snapshot().downloadMbps ?? '—' }}</strong>
          <span class="summary-card__unit">Mbps</span>
        </article>
        <article class="summary-card summary-card--green">
          <span class="summary-card__label">Subida</span>
          <strong class="summary-card__value">{{ telemetry.snapshot().uploadMbps ?? '—' }}</strong>
          <span class="summary-card__unit">Mbps</span>
        </article>
        <article class="summary-card summary-card--yellow">
          <span class="summary-card__label">Batería Edge</span>
          <strong class="summary-card__value">{{ telemetry.snapshot().batteryPercent }}</strong>
          <span class="summary-card__unit">%</span>
        </article>
        <article class="summary-card summary-card--violet">
          <span class="summary-card__label">Temperatura</span>
          <strong class="summary-card__value">{{ telemetry.snapshot().temperatureC ?? '—' }}</strong>
          <span class="summary-card__unit">°C</span>
        </article>
      </section>

      <section class="dash__grid">
        <article class="panel">
          <div class="panel__header">
            <div>
              <p class="panel__eyebrow">estado operativo</p>
              <h2 class="panel__title">Métricas instantáneas</h2>
            </div>
          </div>
          <div class="kv-grid">
            <div class="kv">
              <span class="kv__label">Ping</span>
              <span class="kv__value">{{ telemetry.snapshot().pingMs ?? '—' }} ms</span>
            </div>
            <div class="kv">
              <span class="kv__label">Red</span>
              <span class="kv__value">{{ telemetry.snapshot().networkState }}</span>
            </div>
            <div class="kv">
              <span class="kv__label">API</span>
              <span class="kv__value">{{ telemetry.snapshot().apiState }}</span>
            </div>
            <div class="kv">
              <span class="kv__label">Batería</span>
              <span class="kv__value">{{ telemetry.batteryLabel() }}</span>
            </div>
            <div class="kv">
              <span class="kv__label">Dispositivos</span>
              <span class="kv__value">{{ telemetry.snapshot().connectedDevicesCount ?? 'pendiente' }}</span>
            </div>
            <div class="kv">
              <span class="kv__label">Equipo</span>
              <span class="kv__value">{{ deviceInfo.current().deviceName }}</span>
            </div>
            <div class="kv">
              <span class="kv__label">Node ID</span>
              <span class="kv__value">{{ device.deviceId() }}</span>
            </div>
          </div>
        </article>

        <article class="panel">
          <div class="panel__header">
            <div>
              <p class="panel__eyebrow">conectividad</p>
              <h2 class="panel__title">Perfil de enlace</h2>
            </div>
          </div>
          <div class="kv-grid">
            <div class="kv">
              <span class="kv__label">Tipo efectivo</span>
              <span class="kv__value">{{ connectionProfile().effectiveType ?? '—' }}</span>
            </div>
            <div class="kv">
              <span class="kv__label">Downlink navegador</span>
              <span class="kv__value">{{ connectionProfile().downlinkMbps ?? '—' }} Mbps</span>
            </div>
            <div class="kv">
              <span class="kv__label">RTT navegador</span>
              <span class="kv__value">{{ connectionProfile().rttMs ?? '—' }} ms</span>
            </div>
            <div class="kv">
              <span class="kv__label">Modo ahorro</span>
              <span class="kv__value">{{ connectionProfile().saveData === null ? '—' : (connectionProfile().saveData ? 'sí' : 'no') }}</span>
            </div>
            <div class="kv">
              <span class="kv__label">Emparejado</span>
              <span class="kv__value">{{ pair.isPaired() ? 'sí' : 'no' }}</span>
            </div>
            <div class="kv">
              <span class="kv__label">Estado API</span>
              <span class="kv__value">{{ api.snapshot().error ?? 'sin errores' }}</span>
            </div>
          </div>
        </article>
      </section>

      <section class="dash__charts">
        <article class="panel">
          <div class="panel__header">
            <div>
              <p class="panel__eyebrow">histórico</p>
              <h2 class="panel__title">Latencia</h2>
            </div>
            <span class="panel__meta">pico {{ peakLatency() ?? '—' }} ms</span>
          </div>
          @if (telemetry.latencyHistory().length) {
            <div class="chart-click" (click)="expandChart('latency')">
              <span class="chart-expand-label">expandir</span>
              <p-chart type="line" [data]="latencyChartData()" [options]="chartOptions()"
                [responsive]="true" style="display:block; height:180px">
              </p-chart>
            </div>
          } @else {
            <div class="spark spark--empty">esperando primeras muestras de latencia…</div>
          }
        </article>

        <article class="panel">
          <div class="panel__header">
            <div>
              <p class="panel__eyebrow">histórico</p>
              <h2 class="panel__title">Ancho de banda</h2>
            </div>
            <span class="panel__meta">{{ telemetry.snapshot().downloadMbps ?? '—' }} / {{ telemetry.snapshot().uploadMbps ?? '—' }} Mbps</span>
          </div>
          @if (telemetry.downloadHistory().length || telemetry.uploadHistory().length) {
            <div class="chart-click" (click)="expandChart('bandwidth')">
              <span class="chart-expand-label">expandir</span>
              <p-chart type="line" [data]="bandwidthChartData()" [options]="chartOptions()"
                [responsive]="true" style="display:block; height:180px">
              </p-chart>
            </div>
          } @else {
            <div class="spark spark--empty">esperando primeras muestras de ancho de banda…</div>
          }
        </article>

        <article class="panel">
          <div class="panel__header">
            <div>
              <p class="panel__eyebrow">histórico</p>
              <h2 class="panel__title">Batería</h2>
            </div>
            <span class="panel__meta">{{ telemetry.snapshot().batteryPercent }}%</span>
          </div>
          @if (telemetry.batteryHistory().length) {
            <div class="chart-click" (click)="expandChart('battery')">
              <span class="chart-expand-label">expandir</span>
              <p-chart type="line" [data]="batteryChartData()" [options]="batteryChartOptions()"
                [responsive]="true" style="display:block; height:180px">
              </p-chart>
            </div>
          } @else {
            <div class="spark spark--empty">esperando primeras muestras de batería…</div>
          }
        </article>
      </section>

      <section class="dash__controls">
        <article class="panel">
          <div class="panel__header">
            <div>
              <p class="panel__eyebrow">navegación principal</p>
              <h2 class="panel__title">Centro de control</h2>
            </div>
          </div>
          <div class="control-grid">
            <button class="control-card" (click)="go('/api-status')">
              <span class="control-card__title">Estado API</span>
              <span class="control-card__text">Ver si el backend responde o está desconectado.</span>
            </button>
            <button class="control-card" (click)="go('/latency')">
              <span class="control-card__title">Gráfica de latencia</span>
              <span class="control-card__text">Pantalla separada para revisar respuesta y ping.</span>
            </button>
            <button class="control-card" (click)="go('/bandwidth')">
              <span class="control-card__title">Gráfica de ancho de banda</span>
              <span class="control-card__text">Descarga y subida en una vista dedicada.</span>
            </button>
            <button class="control-card" (click)="go('/battery')">
              <span class="control-card__title">Gráfica de batería</span>
              <span class="control-card__text">Tendencia del nivel de batería del Android.</span>
            </button>
            <button class="control-card" (click)="go('/speedtest')">
              <span class="control-card__title">Speed Test</span>
              <span class="control-card__text">Descarga, subida y ping en una vista dedicada.</span>
            </button>
            <button class="control-card" (click)="go('/audit')">
              <span class="control-card__title">Auditoría</span>
              <span class="control-card__text">Escaneo, dispositivos conectados e historial de red.</span>
            </button>
            <button class="control-card" (click)="go('/modem')">
              <span class="control-card__title">Módem</span>
              <span class="control-card__text">Acciones y control del enlace principal.</span>
            </button>
            <button class="control-card" (click)="go('/settings')">
              <span class="control-card__title">Ajustes</span>
              <span class="control-card__text">Configuración general y estado local del dispositivo.</span>
            </button>
          </div>
        </article>
      </section>

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
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dash {
      min-height: 100%;
      background: #05070a;
      color: #d7dee3;
      padding: 16px;
      font-family: 'JetBrains Mono', monospace;
    }
    .dash__hero {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    .dash__eyebrow {
      margin: 0 0 6px;
      color: #5c6773;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.12em;
    }
    .dash__title {
      margin: 0 0 8px;
      color: #ff7a1a;
      font-size: 24px;
    }
    .dash__subtitle {
      margin: 0;
      color: #8f99a6;
      font-size: 12px;
      max-width: 520px;
      line-height: 1.6;
    }
    .dash__hero-status {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }
    .dash__badge {
      border: 1px solid #1c2530;
      padding: 6px 10px;
      font-size: 11px;
      text-transform: uppercase;
    }
    .dash__badge--ok {
      color: #39ff88;
      border-color: #39ff88;
    }
    .dash__badge--warn {
      color: #ffaa1a;
      border-color: #ffaa1a;
    }
    .dash__badge--err {
      color: #ff5b6e;
      border-color: #ff5b6e;
    }
    .dash__timestamp {
      color: #5c6773;
      font-size: 11px;
    }
    .dash__summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .summary-card {
      position: relative;
      overflow: hidden;
      background: #0a0e14;
      border: 1px solid #1c2530;
      padding: 14px;
    }
    .summary-card::after {
      content: '';
      position: absolute;
      inset: auto 0 0 0;
      height: 2px;
      background: currentColor;
    }
    .summary-card--accent { color: #ff7a1a; }
    .summary-card--cyan { color: #41e0d1; }
    .summary-card--green { color: #39ff88; }
    .summary-card--yellow { color: #ffd23f; }
    .summary-card--violet { color: #9f7aea; }
    .summary-card__label {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      color: #8f99a6;
      margin-bottom: 8px;
    }
    .summary-card__value {
      font-size: 28px;
      line-height: 1;
    }
    .summary-card__unit {
      margin-left: 6px;
      font-size: 12px;
      color: #8f99a6;
    }
    .dash__grid,
    .dash__controls,
    .dash__charts {
      display: grid;
      gap: 12px;
      margin-bottom: 16px;
    }
    .dash__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .panel {
      background: #0a0e14;
      border: 1px solid #1c2530;
      padding: 14px;
    }
    .panel__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }
    .panel__eyebrow {
      margin: 0 0 6px;
      color: #5c6773;
      font-size: 10px;
      text-transform: uppercase;
    }
    .panel__title {
      margin: 0;
      color: #d7dee3;
      font-size: 16px;
    }
    .panel__meta {
      color: #8f99a6;
      font-size: 11px;
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
    .kv-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .kv {
      border: 1px solid #1c2530;
      padding: 10px;
      min-height: 64px;
    }
    .kv__label {
      display: block;
      color: #5c6773;
      text-transform: uppercase;
      font-size: 9px;
      margin-bottom: 6px;
    }
    .kv__value {
      color: #d7dee3;
      font-size: 12px;
      word-break: break-word;
    }
    .spark {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      min-height: 104px;
    }
    .spark--empty {
      align-items: center;
      justify-content: center;
      color: #5c6773;
      border: 1px dashed #1c2530;
      padding: 12px;
      font-size: 11px;
    }
    .control-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .control-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 116px;
      background: #05070a;
      border: 1px solid #1c2530;
      color: #d7dee3;
      padding: 14px;
      text-align: left;
      font-family: inherit;
      cursor: pointer;
    }
    .control-card__title {
      color: #ff7a1a;
      font-size: 14px;
    }
    .control-card__text {
      color: #8f99a6;
      font-size: 11px;
      line-height: 1.5;
    }
    @media (max-width: 720px) {
      .dash__hero,
      .dash__grid,
      .control-grid,
      .dash__summary,
      .kv-grid {
        grid-template-columns: 1fr;
      }
      .dash__hero {
        display: grid;
      }
      .dash__hero-status {
        align-items: flex-start;
      }
    }
  `],
})
export class DashboardComponent {
  private readonly router = inject(Router);
  readonly telemetry = inject(EdgeTelemetryService);
  readonly api = inject(ApiHealthService);
  readonly device = inject(DeviceIdentityService);
  readonly deviceInfo = inject(DeviceInfoService);
  readonly pair = inject(PairingStoreService);

  readonly dialogVisible = signal(false);
  readonly dialogChart = signal<string | null>(null);
  readonly dialogTitle = computed(() => {
    const map: Record<string, string> = {
      latency: 'Latencia histórica',
      bandwidth: 'Ancho de banda',
      battery: 'Batería',
    };
    return map[this.dialogChart() ?? ''] ?? '';
  });

  readonly connectionProfile = computed<ConnectionProfile>(() => this.telemetry.connectionProfile());
  readonly sampledAtLabel = computed(() =>
    new Date(this.telemetry.snapshot().capturedAt).toLocaleTimeString(),
  );
  readonly apiBadgeLabel = computed(() => {
    const state = this.api.snapshot().state;
    if (state === 'online') return 'API conectada';
    if (state === 'checking') return 'Verificando API';
    if (state === 'idle') return 'Sin prueba';
    return 'API desconectada';
  });
  readonly apiBadgeClass = computed(() => {
    const state = this.api.snapshot().state;
    if (state === 'online') return 'dash__badge--ok';
    if (state === 'checking') return 'dash__badge--warn';
    return 'dash__badge--err';
  });

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

  readonly chartOptions = computed(() => ({
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
    ...this.chartOptions(),
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

  private toLabels(points: { capturedAt: number }[]): string[] {
    return points.map((p) =>
      new Date(p.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    );
  }

  readonly latencyChartData = computed(() => ({
    labels: this.toLabels(this.telemetry.latencyHistory()),
    datasets: [{
      label: 'ms',
      data: this.telemetry.latencyHistory().map((p) => p.value),
      borderColor: '#FF7A1A',
      backgroundColor: 'rgba(255,122,26,0.12)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    }],
  }));

  readonly bandwidthChartData = computed(() => ({
    labels: this.toLabels(this.telemetry.downloadHistory()),
    datasets: [
      {
        label: 'Descarga Mbps',
        data: this.telemetry.downloadHistory().map((p) => p.value),
        borderColor: '#41E0D1',
        backgroundColor: 'rgba(65,224,209,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
      {
        label: 'Subida Mbps',
        data: this.telemetry.uploadHistory().map((p) => p.value),
        borderColor: '#39FF88',
        backgroundColor: 'rgba(57,255,136,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  }));

  readonly batteryChartData = computed(() => ({
    labels: this.toLabels(this.telemetry.batteryHistory()),
    datasets: [{
      label: '% batería',
      data: this.telemetry.batteryHistory().map((p) => p.value),
      borderColor: '#FFD23F',
      backgroundColor: 'rgba(255,210,63,0.12)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    }],
  }));

  readonly peakLatency = computed(() => {
    const vals = this.telemetry.latencyHistory().map((p) => p.value);
    return vals.length ? Math.max(...vals) : null;
  });

  expandChart(type: string): void {
    this.dialogChart.set(type);
    this.dialogVisible.set(true);
  }

  closeDialog(): void {
    this.dialogVisible.set(false);
    this.dialogChart.set(null);
  }

  go(path: string): void {
    this.router.navigateByUrl(path);
  }
}
