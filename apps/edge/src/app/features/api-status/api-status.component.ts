import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiHealthService } from '../../core/api/api-health.service';
import { ServerConfigService } from '../../core/config/server-config.service';

@Component({
  selector: 'app-api-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="api">
      <header class="api__header">
        <div>
          <p class="api__eyebrow">estado del backend</p>
          <h2 class="api__title">Conexión con API</h2>
        </div>
        <span class="api__badge" [class]="badgeClass()">{{ badgeLabel() }}</span>
      </header>

      <section class="api__panel">
        <div class="api__row">
          <span class="api__label">base url</span>
          <span class="api__value">{{ server.apiBaseUrl() }}</span>
        </div>
        <div class="api__row">
          <span class="api__label">latencia api</span>
          <span class="api__value">{{ snapshot().latencyMs ?? '—' }} ms</span>
        </div>
        <div class="api__row">
          <span class="api__label">último check</span>
          <span class="api__value">{{ checkedAtLabel() }}</span>
        </div>
        <div class="api__row">
          <span class="api__label">detalle</span>
          <span class="api__value">{{ snapshot().error ?? 'sin errores' }}</span>
        </div>
      </section>

      <button class="api__action" (click)="refresh()">verificar ahora</button>
    </div>
  `,
  styles: [
    `
      .api {
        min-height: 100%;
        background: #05070a;
        color: #d7dee3;
        padding: 16px;
        font-family: 'JetBrains Mono', monospace;
      }
      .api__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }
      .api__eyebrow {
        margin: 0 0 6px;
        color: #5c6773;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.12em;
      }
      .api__title {
        margin: 0;
        color: #ff7a1a;
        font-size: 22px;
      }
      .api__badge {
        border: 1px solid #1c2530;
        padding: 6px 10px;
        font-size: 11px;
        text-transform: uppercase;
      }
      .api__badge--ok {
        color: #39ff88;
        border-color: #39ff88;
      }
      .api__badge--warn {
        color: #ffaa1a;
        border-color: #ffaa1a;
      }
      .api__badge--err {
        color: #ff5b6e;
        border-color: #ff5b6e;
      }
      .api__panel {
        background: #0a0e14;
        border: 1px solid #1c2530;
        margin-bottom: 16px;
      }
      .api__row {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 12px;
        padding: 12px;
        border-bottom: 1px solid #1c2530;
      }
      .api__row:last-child {
        border-bottom: none;
      }
      .api__label {
        color: #5c6773;
        font-size: 10px;
        text-transform: uppercase;
      }
      .api__value {
        color: #d7dee3;
        font-size: 12px;
        word-break: break-word;
      }
      .api__action {
        width: 100%;
        border: 1px solid #ff7a1a;
        background: transparent;
        color: #ff7a1a;
        padding: 14px;
        font-family: inherit;
        font-size: 12px;
        text-transform: uppercase;
        cursor: pointer;
      }
    `,
  ],
})
export class ApiStatusComponent {
  readonly api = inject(ApiHealthService);
  readonly server = inject(ServerConfigService);
  readonly snapshot = this.api.snapshot;

  readonly badgeClass = computed(() => {
    const state = this.snapshot().state;
    if (state === 'online') return 'api__badge--ok';
    if (state === 'checking') return 'api__badge--warn';
    return 'api__badge--err';
  });

  readonly badgeLabel = computed(() => {
    const state = this.snapshot().state;
    if (state === 'online') return 'api conectada';
    if (state === 'checking') return 'verificando';
    if (state === 'idle') return 'sin prueba';
    return 'api desconectada';
  });

  readonly checkedAtLabel = computed(() => {
    const checkedAt = this.snapshot().checkedAt;
    return checkedAt ? new Date(checkedAt).toLocaleTimeString() : '—';
  });

  refresh(): void {
    void this.api.checkNow();
  }
}
