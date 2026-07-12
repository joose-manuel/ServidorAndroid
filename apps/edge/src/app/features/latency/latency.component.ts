import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EdgeTelemetryService } from '../../core/telemetry/edge-telemetry.service';

@Component({
  selector: 'app-latency',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="screen">
      <header class="screen__header">
        <p class="screen__eyebrow">gráfica separada</p>
        <h2 class="screen__title">Latencia histórica</h2>
        <p class="screen__subtitle">Seguimiento continuo del tiempo de respuesta de la conexión.</p>
      </header>

      <section class="stats">
        <div class="stats__card">
          <span class="stats__label">actual</span>
          <strong class="stats__value">{{ telemetry.snapshot().latencyMs ?? '—' }} ms</strong>
        </div>
        <div class="stats__card">
          <span class="stats__label">ping</span>
          <strong class="stats__value">{{ telemetry.snapshot().pingMs ?? '—' }} ms</strong>
        </div>
      </section>

      <section class="panel">
        <div class="panel__meta">40 muestras recientes</div>
        <div class="chart">
          @for (point of telemetry.latencyHistory(); track point.capturedAt) {
            <span class="chart__bar" [style.height.%]="trendPercent(point.value)"></span>
          }
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .screen { background: #05070a; color: #d7dee3; padding: 16px; min-height: 100%; font-family: 'JetBrains Mono', monospace; }
      .screen__header { margin-bottom: 16px; }
      .screen__eyebrow { margin: 0 0 6px; color: #5c6773; font-size: 10px; text-transform: uppercase; }
      .screen__title { margin: 0 0 8px; color: #ff7a1a; font-size: 22px; }
      .screen__subtitle { margin: 0; color: #8f99a6; font-size: 12px; }
      .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
      .stats__card, .panel { background: #0a0e14; border: 1px solid #1c2530; padding: 14px; }
      .stats__label, .panel__meta { display: block; color: #5c6773; font-size: 10px; text-transform: uppercase; margin-bottom: 8px; }
      .stats__value { color: #ff7a1a; font-size: 24px; }
      .chart { display: flex; align-items: flex-end; gap: 4px; min-height: 220px; }
      .chart__bar { flex: 1; min-height: 4px; background: #ff7a1a; border-radius: 2px 2px 0 0; }
      @media (max-width: 720px) { .stats { grid-template-columns: 1fr; } }
    `,
  ],
})
export class LatencyComponent {
  readonly telemetry = inject(EdgeTelemetryService);

  trendPercent(value: number): number {
    const points = this.telemetry.latencyHistory();
    if (!points.length) return 24;
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return 56;
    return Math.min(100, Math.max(12, Math.round(((value - min) / (max - min)) * 88) + 12));
  }
}
