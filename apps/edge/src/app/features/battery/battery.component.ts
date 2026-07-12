import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EdgeTelemetryService } from '../../core/telemetry/edge-telemetry.service';

@Component({
  selector: 'app-battery',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="screen">
      <header class="screen__header">
        <p class="screen__eyebrow">gráfica separada</p>
        <h2 class="screen__title">Batería del Edge</h2>
        <p class="screen__subtitle">Nivel actual, tendencia reciente y estado de carga del dispositivo.</p>
      </header>

      <section class="stats">
        <div class="stats__card">
          <span class="stats__label">nivel actual</span>
          <strong class="stats__value">{{ telemetry.snapshot().batteryPercent }}%</strong>
        </div>
        <div class="stats__card">
          <span class="stats__label">estado</span>
          <strong class="stats__value">{{ telemetry.batteryLabel() }}</strong>
        </div>
      </section>

      <section class="panel">
        <div class="panel__meta">histórico de batería</div>
        <div class="chart">
          @for (point of telemetry.batteryHistory(); track point.capturedAt) {
            <span class="chart__bar" [style.height.%]="point.value"></span>
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
      .stats__value { color: #ffd23f; font-size: 24px; }
      .chart { display: flex; align-items: flex-end; gap: 4px; min-height: 220px; color: #ffd23f; }
      .chart__bar { flex: 1; min-height: 4px; background: currentColor; border-radius: 2px 2px 0 0; }
      @media (max-width: 720px) { .stats { grid-template-columns: 1fr; } }
    `,
  ],
})
export class BatteryComponent {
  readonly telemetry = inject(EdgeTelemetryService);
}
