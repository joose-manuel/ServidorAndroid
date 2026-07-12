import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HudPanelComponent } from '@servidor/ui-components';
import { ServerConfigService } from '../../core/config/server-config.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';

@Component({
  selector: 'app-pair',
  standalone: true,
  imports: [CommonModule, FormsModule, HudPanelComponent],
  template: `
    <hud-panel title="Conectar edge node">
      <div class="pair">
        <section class="body">
          <p class="desc">
            Usá la misma URL pública del backend que configuraste en Android.
            Si el nodo ya está apuntando a la API desplegada, pegá esa URL aquí
            y luego ingresá el <strong>código de 6 dígitos</strong> que te muestra el S9.
          </p>
          <div class="row">
            <input
              class="input"
              type="text"
              placeholder="https://api.tu-dominio.com/api"
              [ngModel]="urlDraft()"
              (ngModelChange)="urlDraft.set($event)"
            />
          </div>
          <div class="row">
            <input
              class="input input--code"
              type="text"
              maxlength="6"
              placeholder="123456"
              [ngModel]="pairingCode()"
              (ngModelChange)="onPairingCodeChange($event)"
            />
            <button class="btn" (click)="connect()" [disabled]="connecting()">
              {{ connecting() ? 'vinculando…' : 'vincular' }}
            </button>
          </div>
          @if (error(); as e) {
            <div class="err">✗ {{ e }}</div>
          }
          @if (connected()) {
            <div class="ok">
              <div class="ok__line">&gt; ¡Nodo vinculado!</div>
              <div class="ok__line">&gt; Device ID: {{ pairedDeviceId() }}</div>
              <div class="ok__line">&gt; Latencia API: {{ latency() }} ms</div>
              <div class="ok__line">&gt; Andá al dashboard para ver métricas reales del S9.</div>
              <button class="btn btn--primary" (click)="goDashboard()">
                ir al dashboard
              </button>
            </div>
          }
        </section>
      </div>
    </hud-panel>
  `,
  styles: [
    `
      .pair { font-family: 'JetBrains Mono', monospace; }
      .body { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }
      .desc {
        color: #5c6773; font-size: 12px; margin: 0; line-height: 1.6;
      }
      .desc strong { color: #d7dee3; }
      .desc code {
        color: #39ff88; background: #0a0e14; padding: 1px 4px; font-size: 11px;
      }
      .row { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
      .input {
        background: #0a0e14; border: 1px solid #1c2530; color: #39ff88;
        font-family: inherit; font-size: 13px; padding: 10px; outline: none;
      }
      .input--code {
        letter-spacing: 4px;
        text-align: center;
        font-weight: 700;
      }
      .input:focus { border-color: #ff7a1a; }
      .btn {
        background: #1c2530; color: #d7dee3; border: none; padding: 10px 16px;
        font-family: inherit; font-size: 11px; font-weight: 700;
        text-transform: uppercase; cursor: pointer;
      }
      .btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .btn--primary { background: #ff7a1a; color: #05070a; }
      .err { color: #ff4444; font-size: 11px; padding: 6px 10px; border: 1px solid #ff4444; }
      .ok {
        color: #39ff88; background: #05070a; padding: 12px;
        border: 1px solid #1c6a2e; display: flex; flex-direction: column; gap: 8px;
      }
      .ok__line { line-height: 1.6; font-size: 12px; }
    `,
  ],
})
export class PairComponent {
  private readonly router = inject(Router);
  readonly server = inject(ServerConfigService);
  private readonly pairingStore = inject(PairingStoreService);

  readonly urlDraft = signal('');
  readonly pairingCode = signal('');
  readonly connecting = signal(false);
  readonly connected = signal(false);
  readonly latency = signal(0);
  readonly pairedDeviceId = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  onPairingCodeChange(value: string): void {
    this.pairingCode.set(value.replace(/\D/g, '').slice(0, 6));
  }

  async connect(): Promise<void> {
    this.connecting.set(true);
    this.error.set(null);
    this.connected.set(false);
    this.pairedDeviceId.set(null);

    const rawUrl = this.urlDraft().trim();
    const pairingCode = this.pairingCode();
    if (pairingCode.length !== 6) {
      this.connecting.set(false);
      this.error.set('ingresá el código de 6 dígitos que muestra el Android');
      return;
    }

    if (rawUrl) {
      const normalizedUrl = rawUrl.replace(/\/+$/, '');
      const apiUrl = normalizedUrl.includes('/api') ? normalizedUrl : `${normalizedUrl}/api`;
      await this.server.setApiBaseUrl(apiUrl);
    }

    const result = await this.server.discover();
    if (result?.state !== 'ok') {
      this.connecting.set(false);
      this.error.set(result?.error ?? 'no se pudo contactar la API');
      return;
    }

    this.latency.set(result.latencyMs ?? 0);

    try {
      const response = await fetch(`${this.server.apiBaseUrl()}/edge/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: pairingCode }),
      });
      const body = (await response.json()) as { deviceId?: string; message?: string };

      if (!response.ok || !body.deviceId) {
        throw new Error(body.message ?? 'código inválido o expirado');
      }

      this.pairingStore.setPaired(body.deviceId);
      this.pairedDeviceId.set(body.deviceId);
      this.connected.set(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'no se pudo vincular el nodo';
      this.error.set(message);
    } finally {
      this.connecting.set(false);
    }
  }

  goDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
