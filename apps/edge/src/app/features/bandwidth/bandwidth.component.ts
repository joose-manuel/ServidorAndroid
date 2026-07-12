import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EdgeTelemetryService } from '../../core/telemetry/edge-telemetry.service';

@Component({
  selector: 'app-bandwidth',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="screen">
      <header class="screen__header">
        <p class="screen__eyebrow">gráfica separada</p>
        <h2 class="screen__title">Ancho de banda</h2>
        <p class="screen__subtitle">Vista enfocada en descarga y subida tomadas desde el Android.</p>
      </header>

      <section class="stats">
        <div class="stats__card stats__card--cyan">
          <span class="stats__label">descarga actual</span>
          <strong class="stats__value">{{ telemetry.snapshot().downloadMbps ?? '—' }} Mbps</strong>
        </div>
        <div class="stats__card stats__card--green">
          <span class="stats__label">subida actual</span>
          <strong class="stats__value">{{ telemetry.snapshot().uploadMbps ?? '—' }} Mbps</strong>
        </div>
      </section>

      <section class="panel">
        <div class="panel__meta">descarga</div>
        <div class="chart chart--cyan">
          @for (point of telemetry.downloadHistory(); track point.capturedAt) {
            <span class="chart__bar" [style.height.%]="trendPercent(point.value, 'download')"></span>
          }
        </div>
      </section>

      <section class="panel">
        <div class="panel__meta">subida</div>
        <div class="chart chart--green">
          @for (point of telemetry.uploadHistory(); track point.capturedAt) {
            <span class="chart__bar" [style.height.%]="trendPercent(point.value, 'upload')"></span>
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
      .stats__card, .panel { background: #0a0e14; border: 1px solid #1c2530; padding: 14px; margin-bottom: 12px; }
      .stats__label, .panel__meta { display: block; color: #5c6773; font-size: 10px; text-transform: uppercase; margin-bottom: 8px; }
      .stats__value { font-size: 24px; }
      .stats__card--cyan .stats__value, .chart--cyan { color: #41e0d1; }
      .stats__card--green .stats__value, .chart--green { color: #39ff88; }
      .chart { display: flex; align-items: flex-end; gap: 4px; min-height: 180px; }
      .chart__bar { flex: 1; min-height: 4px; background: currentColor; border-radius: 2px 2px 0 0; }
      @media (max-width: 720px) { .stats { grid-template-columns: 1fr; } }
    `,
  ],
})
export class BandwidthComponent {
  readonly telemetry = inject(EdgeTelemetryService);

  trendPercent(value: number, series: 'download' | 'upload'): number {
    const points =
      series === 'download' ? this.telemetry.downloadHistory() : this.telemetry.uploadHistory();
    if (!points.length) return 24;
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return 56;
    return Math.min(100, Math.max(12, Math.round(((value - min) / (max - min)) * 88) + 12));
  }
}
