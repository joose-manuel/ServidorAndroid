import { Component, inject, computed, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpeedTestService } from './speedtest.service';

@Component({
  selector: 'app-speedtest',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="st">
      <h2 class="st__title">&gt; speed-test</h2>

      <div class="st__current">
        <div class="st__big">
          @if (svc.current(); as c) {
            <div class="st__value">{{ c.downloadMbps ?? '—' }}<span class="st__unit"> Mbps down</span></div>
            <div class="st__sub">
              subida {{ c.uploadMbps ?? '—' }} Mbps · ping {{ c.pingMs ?? '—' }} ms ·
              {{ c.bytesDownloaded ? formatBytes(c.bytesDownloaded) : 'sin descarga' }}
              @if (c.durationMs > 0) {
                <span> en {{ (c.durationMs / 1000).toFixed(1) }}s</span>
              }
            </div>
          } @else {
            <div class="st__value st__value--muted">—<span class="st__unit"> Mbps</span></div>
            <div class="st__sub">sin medición</div>
          }
        </div>
        <div class="st__stats">
          <div class="st__stat">
            <div class="st__stat-label">promedio</div>
            <div class="st__stat-val">{{ svc.avgMbps() !== null ? (svc.avgMbps() | number:'1.0-1') : '—' }}</div>
          </div>
          <div class="st__stat">
            <div class="st__stat-label">pico</div>
            <div class="st__stat-val">{{ svc.peakMbps() !== null ? (svc.peakMbps() | number:'1.0-1') : '—' }}</div>
          </div>
          <div class="st__stat">
            <div class="st__stat-label">muestras</div>
            <div class="st__stat-val">{{ svc.history().length }}</div>
          </div>
          <div class="st__stat">
            <div class="st__stat-label">subida</div>
            <div class="st__stat-val">{{ svc.current()?.uploadMbps ?? '—' }}</div>
          </div>
          <div class="st__stat">
            <div class="st__stat-label">ping</div>
            <div class="st__stat-val">{{ svc.current()?.pingMs ?? '—' }}</div>
          </div>
          <div class="st__stat">
            <div class="st__stat-label">payload up</div>
            <div class="st__stat-val">{{ svc.current() ? formatBytes(svc.current()!.bytesUploaded) : '—' }}</div>
          </div>
        </div>
      </div>

      <div class="st__chart">
        @if (chartPoints().length > 1) {
          <svg viewBox="0 0 600 160" preserveAspectRatio="none" class="st__svg">
            <defs>
              <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#39ff88" stop-opacity="0.5" />
                <stop offset="100%" stop-color="#39ff88" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path [attr.d]="areaPath()" fill="url(#grad)" />
            <path [attr.d]="linePath()" fill="none" stroke="#39ff88" stroke-width="1.5" />
            <line x1="0" [attr.y1]="yScale(0)" x2="600" [attr.y2]="yScale(0)"
                  stroke="#1c2530" stroke-width="1" stroke-dasharray="2 2" />
            @for (label of yLabels(); track label) {
              <text [attr.x]="4" [attr.y]="yScale(label.value) + 3"
                    fill="#5c6773" font-size="9" font-family="monospace">{{ label.text }}</text>
            }
          </svg>
        } @else {
          <div class="st__chart-empty">sin datos · iniciá una medición</div>
        }
      </div>

      <div class="st__cfg">
        <div class="st__field">
          <label class="st__label" for="interval">intervalo (segundos)</label>
          <input id="interval" type="number" min="5" max="3600"
                 class="st__input" [ngModel]="cfg().intervalSec"
                 (ngModelChange)="onInterval($event)" />
          <p class="st__hint">cada cuánto se repite la medición automáticamente</p>
        </div>
        <div class="st__field">
          <label class="st__label" for="duration">duración (segundos)</label>
          <input id="duration" type="number" min="2" max="60"
                 class="st__input" [ngModel]="cfg().durationSec"
                 (ngModelChange)="onDuration($event)" />
          <p class="st__hint">cuánto dura cada descarga individual</p>
        </div>
        <div class="st__field st__field--full">
          <label class="st__label" for="url">URL del archivo a descargar</label>
          <input id="url" type="text"
                 class="st__input" [ngModel]="cfg().downloadTargetUrl"
                 (ngModelChange)="onDownloadUrl($event)" />
          <p class="st__hint">default: cloudflare speed test · el tamaño se calcula como duración × 5 Mbps</p>
        </div>
        <div class="st__field st__field--full">
          <label class="st__label" for="uploadUrl">URL del endpoint de subida</label>
          <input id="uploadUrl" type="text"
                 class="st__input" [ngModel]="cfg().uploadTargetUrl"
                 (ngModelChange)="onUploadUrl($event)" />
          <p class="st__hint">se usa para medir Mbps de subida con una carga simple</p>
        </div>
        <div class="st__field st__field--full">
          <label class="st__label" for="pingUrl">URL de ping</label>
          <input id="pingUrl" type="text"
                 class="st__input" [ngModel]="cfg().pingTargetUrl"
                 (ngModelChange)="onPingUrl($event)" />
          <p class="st__hint">endpoint liviano para medir latencia y disponibilidad</p>
        </div>
      </div>

      <div class="st__actions">
        @if (svc.running()) {
          <button class="cta cta--danger" (click)="stop()">detener</button>
          <button class="cta cta--ghost" (click)="measureNow()">medir ahora</button>
        } @else {
          <button class="cta" (click)="start()">iniciar medición</button>
          @if (svc.history().length > 0) {
            <button class="cta cta--ghost" (click)="clear()">borrar histórico</button>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .st {
        background: #05070a;
        color: #d7dee3;
        padding: 16px;
        font-family: 'JetBrains Mono', monospace;
      }
      .st__title {
        color: #ff7a1a;
        font-size: 16px;
        margin: 0 0 16px;
      }
      .st__current {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 16px;
      }
      .st__big {
        background: #0a0e14;
        border: 1px solid #1c2530;
        padding: 16px;
      }
      .st__value {
        color: #39ff88;
        font-size: 36px;
        font-weight: 700;
      }
      .st__value--muted { color: #5c6773; }
      .st__unit { font-size: 14px; color: #5c6773; margin-left: 4px; }
      .st__sub {
        color: #5c6773;
        font-size: 11px;
        margin-top: 4px;
      }
      .st__stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .st__stat {
        background: #0a0e14;
        border: 1px solid #1c2530;
        padding: 8px;
        text-align: center;
      }
      .st__stat-label {
        color: #5c6773;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .st__stat-val {
        color: #d7dee3;
        font-size: 18px;
        margin-top: 4px;
      }
      .st__chart {
        background: #0a0e14;
        border: 1px solid #1c2530;
        height: 160px;
        margin-bottom: 16px;
        position: relative;
      }
      .st__svg { width: 100%; height: 100%; display: block; }
      .st__chart-empty {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #5c6773;
        font-size: 12px;
      }
      .st__cfg {
        background: #0a0e14;
        border: 1px solid #1c2530;
        padding: 12px;
        margin-bottom: 12px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .st__field { display: flex; flex-direction: column; gap: 4px; }
      .st__field--full { grid-column: 1 / -1; }
      .st__label {
        color: #ff7a1a;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .st__input {
        background: #05070a;
        border: 1px solid #1c2530;
        color: #d7dee3;
        padding: 8px;
        font-family: inherit;
        font-size: 13px;
      }
      .st__input:focus { outline: none; border-color: #ff7a1a; }
      .st__hint { color: #5c6773; font-size: 10px; margin: 0; }
      .st__actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .cta {
        background: #ff7a1a;
        color: #05070a;
        border: none;
        padding: 14px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        cursor: pointer;
      }
      .cta--ghost { background: transparent; color: #5c6773; border: 1px solid #1c2530; }
      .cta--danger { background: #ff4444; color: #fff; }
    `,
  ],
})
export class SpeedtestComponent implements OnInit, OnDestroy {
  readonly svc = inject(SpeedTestService);

  readonly cfg = computed(() => this.svc.config());
  readonly chartPoints = computed(() => this.svc.history());

  private readonly viewWidth = 600;
  private readonly viewHeight = 160;

  readonly yMax = computed(() => {
    const h = this.svc.history();
    if (!h.length) return 100;
    const max = Math.max(...h.map((s) => s.mbps), 10);
    return Math.ceil(max / 10) * 10;
  });

  readonly yLabels = computed(() => {
    const max = this.yMax();
    const step = max / 4;
    return [0, 1, 2, 3, 4].map((i) => ({
      value: step * i,
      text: `${Math.round(step * i)} Mbps`,
    }));
  });

  yScale(value: number): number {
    return this.viewHeight - (value / this.yMax()) * (this.viewHeight - 10) - 5;
  }

  xScale(index: number, total: number): number {
    if (total <= 1) return 0;
    return (index / (total - 1)) * (this.viewWidth - 10) + 5;
  }

  linePath = computed(() => {
    const h = this.svc.history();
    if (!h.length) return '';
    return h
      .map((s, i) => `${i === 0 ? 'M' : 'L'}${this.xScale(i, h.length)},${this.yScale(s.mbps)}`)
      .join(' ');
  });

  areaPath = computed(() => {
    const h = this.svc.history();
    if (!h.length) return '';
    const line = h
      .map((s, i) => `${i === 0 ? 'M' : 'L'}${this.xScale(i, h.length)},${this.yScale(s.mbps)}`)
      .join(' ');
    return `${line} L${this.xScale(h.length - 1, h.length)},${this.viewHeight} L${this.xScale(0, h.length)},${this.viewHeight} Z`;
  });

  ngOnInit(): void {
    if (this.svc.history().length === 0) {
      void this.svc.measureOnce();
    }
  }

  ngOnDestroy(): void {
    this.svc.stop();
  }

  start(): void { this.svc.start(); }
  stop(): void { this.svc.stop(); }
  clear(): void { this.svc.clearHistory(); }
  measureNow(): void { void this.svc.measureOnce(); }

  onInterval(v: number): void {
    this.svc.setConfig({ intervalSec: Number(v) || 60 });
  }
  onDuration(v: number): void {
    this.svc.setConfig({ durationSec: Number(v) || 8 });
  }
  onDownloadUrl(v: string): void {
    this.svc.setConfig({ downloadTargetUrl: v });
  }
  onUploadUrl(v: string): void {
    this.svc.setConfig({ uploadTargetUrl: v });
  }
  onPingUrl(v: string): void {
    this.svc.setConfig({ pingTargetUrl: v });
  }

  formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }
}
