import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';
import { ServerConfigService } from '../../core/config/server-config.service';
import { DeviceIdentityService } from '../../core/device/device-identity.service';
import { NetworkStatusService } from '../../core/network/network-status.service';

@Component({
  selector: 'app-boot',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="boot">
      <header class="hdr">
        <div class="hdr__brand">&gt; edge-node</div>
        <div class="hdr__net" [class]="netClass()">
          <span class="hdr__net-dot"></span>
          @switch (net.current().state) {
            @case ('checking') { midiendo… }
            @case ('ok') { {{ net.current().latencyMs }} ms · {{ shortTarget() }} }
            @case ('slow') { {{ net.current().latencyMs }} ms (lento) }
            @case ('offline') { sin internet }
            @default { — }
          }
        </div>
      </header>

      <!-- Servidor -->
      <section class="setup">
        <div class="setup__row">
          <span class="setup__label">1 · internet</span>
          <span class="setup__val" [class]="netClass()">{{ netLabel() }}</span>
        </div>
        <div class="setup__row">
          <span class="setup__label">2 · servidor</span>
          <span class="setup__val" [class]="serverClass()">{{ serverLabel() }}</span>
        </div>

        @if (server.lastDiscovery(); as r) {
          <div class="setup__result" [class]="resultClass(r.state)">
            <div class="setup__result-row">
              <span class="setup__result-state">
                @switch (r.state) {
                  @case ('ok') { ✓ ok }
                  @case ('fail') { ✗ falló }
                  @default { … }
                }
              </span>
              <span class="setup__result-url">{{ r.url }}</span>
            </div>
            <div class="setup__result-row setup__result-row--muted">
              @if (r.latencyMs !== null) {
                <span>{{ r.latencyMs }} ms</span>
              }
              @if (r.error) {
                <span>· {{ r.error }}</span>
              }
            </div>
          </div>
        }

        @if (!server.isConfigured()) {
          <section class="pair pair--hint">
            <p class="pair__hint">configurá la URL del servidor</p>
            <input
              class="setup__input"
              type="text"
              placeholder="https://servidorandroid.seenode.app/api"
              [value]="manualUrl()"
              (input)="onManualUrlInput($event)"
            />
            <button
              class="cta"
              [disabled]="!manualUrl().trim()"
              (click)="useManualUrl()"
            >
              usar esta URL
            </button>
          </section>
        }
      </section>

      <!-- Pairing -->
      @if (server.isConfigured()) {
        <section class="pair">
          @if (paired()) {
            <div class="pair__state pair__state--ok">VINCULADO</div>
            <p class="pair__hint">nodo conectado con la web</p>
            <button class="cta" (click)="goToDashboard()">
              ir al dashboard
            </button>
            <button class="cta cta--link" (click)="forgetPairing()">
              olvidar vinculación
            </button>
          } @else if (error()) {
            <p class="pair__error">{{ error() }}</p>
            <button class="cta" [disabled]="connecting()" (click)="connectToWeb()">reintentar</button>
          } @else if (connecting()) {
            <div class="pair__state pair__state--wait">CONECTANDO</div>
            <p class="pair__hint">enviando el nodo a la API para que la web lo detecte</p>
          } @else {
            <button class="cta" [disabled]="connecting()" (click)="connectToWeb()">conectar con la web</button>
          }
        </section>
      }
    </div>
  `,
  styles: [
    `
      .boot {
        min-height: 100vh;
        background: #05070a;
        color: #d7dee3;
        padding: 16px;
        font-family: 'JetBrains Mono', monospace;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .hdr {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid #1c2530;
      }
      .hdr__brand { color: #ff7a1a; font-size: 14px; }
      .hdr__net {
        font-size: 11px;
        color: #5c6773;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .hdr__net-dot {
        width: 8px; height: 8px; border-radius: 50%; background: #5c6773;
      }
      .hdr__net--ok .hdr__net-dot { background: #39ff88; }
      .hdr__net--slow .hdr__net-dot { background: #ffaa1a; }
      .hdr__net--offline .hdr__net-dot { background: #ff4444; }
      .hdr__net--ok { color: #39ff88; }
      .hdr__net--slow { color: #ffaa1a; }
      .hdr__net--offline { color: #ff4444; }

      .setup {
        background: #0a0e14;
        border: 1px solid #1c2530;
        padding: 12px;
      }
      .setup__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        padding: 5px 0;
        border-bottom: 1px solid #1c2530;
      }
      .setup__row:last-of-type { border-bottom: none; }
      .setup__label { color: #ff7a1a; text-transform: uppercase; letter-spacing: 1px; }
      .setup__val { color: #d7dee3; }
      .setup__val--ok { color: #39ff88; }
      .setup__val--warn { color: #ffaa1a; }
      .setup__val--err { color: #ff4444; }
      .setup__val--muted { color: #5c6773; }
      .setup__field { margin-top: 12px; }
      .setup__fieldlabel {
        display: block;
        color: #5c6773;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 6px;
      }
      .setup__input-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
      }
      .setup__input {
        width: 100%;
        background: #05070a;
        border: 1px solid #1c2530;
        color: #39ff88;
        padding: 10px;
        font-family: inherit;
        font-size: 12px;
        box-sizing: border-box;
      }
      .setup__input:focus { outline: none; border-color: #ff7a1a; }
      .setup__result {
        margin-top: 10px;
        padding: 8px;
        border: 1px solid #1c2530;
        font-size: 11px;
      }
      .setup__result--ok { border-color: #39ff88; }
      .setup__result--fail { border-color: #ff4444; }
      .setup__result--checking { border-color: #ffaa1a; }
      .setup__result-row {
        display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
      }
      .setup__result-row--muted { color: #5c6773; margin-top: 4px; font-size: 10px; }
      .setup__result-state { font-weight: 700; }
      .setup__result--ok .setup__result-state { color: #39ff88; }
      .setup__result--fail .setup__result-state { color: #ff4444; }
      .setup__result-url { flex: 1; word-break: break-all; color: #d7dee3; }

      .pair { text-align: center; padding: 20px 0; }
      .pair--hint { padding: 12px 0; }
      .pair__state {
        font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0 8px;
      }
      .pair__state--ok { color: #ff7a1a; }
      .pair__state--wait { color: #39ff88; }
      .pair__hint { color: #5c6773; font-size: 11px; margin: 4px 0; }
      .pair__error {
        color: #ff4444; font-size: 12px; margin: 12px 0; white-space: pre-line;
      }

      .cta {
        width: 100%;
        background: #ff7a1a;
        color: #05070a;
        border: none;
        padding: 14px;
        font-family: inherit;
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        cursor: pointer;
      }
      .cta:disabled { opacity: 0.4; cursor: not-allowed; }
      .cta--link {
        background: transparent; color: #5c6773; border: none;
        font-size: 11px; text-decoration: underline; margin-top: 8px;
      }
    `,
  ],
})
export class BootComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly pairStore = inject(PairingStoreService);
  private readonly deviceIdentity = inject(DeviceIdentityService);
  readonly server = inject(ServerConfigService);
  readonly net = inject(NetworkStatusService);

  readonly paired = signal(this.pairStore.isPaired());
  readonly connecting = signal(false);
  readonly error = signal<string | null>(null);
  readonly edgeNodeId = this.deviceIdentity.deviceId;
  readonly manualUrl = signal('');

  constructor() {
    this.net.start();
  }

  ngOnDestroy(): void {
    this.net.stop();
  }

  netClass(): string {
    const s = this.net.current().state;
    return s === 'ok' || s === 'slow' || s === 'offline'
      ? `hdr__net--${s}`
      : '';
  }

  netLabel(): string {
    const c = this.net.current();
    if (c.state === 'ok' || c.state === 'slow') {
      return `${c.latencyMs} ms · ${this.shortTarget()}`;
    }
    if (c.state === 'offline') return 'sin internet';
    if (c.state === 'checking') return 'midiendo…';
    return '—';
  }

  shortTarget(): string {
    try {
      const u = new URL(this.net.current().target);
      return u.hostname;
    } catch {
      return this.net.current().target;
    }
  }

  serverClass(): string {
    if (!this.server.isConfigured()) return 'setup__val--muted';
    const d = this.server.lastDiscovery();
    if (!d) return '';
    if (d.state === 'ok') return 'setup__val--ok';
    if (d.state === 'fail') return 'setup__val--err';
    return 'setup__val--warn';
  }

  serverLabel(): string {
    if (!this.server.isConfigured()) return '— sin URL —';
    const d = this.server.lastDiscovery();
    if (!d) return 'probando…';
    if (d.state === 'ok') return 'ok';
    if (d.state === 'fail') return `falló · ${d.error ?? '?'}`;
    return 'probando…';
  }

  resultClass(s: 'ok' | 'fail' | 'checking'): string {
    return `setup__result setup__result--${s}`;
  }

  onManualUrlInput(ev: Event): void {
    this.manualUrl.set((ev.target as HTMLInputElement).value);
  }

  async useManualUrl(): Promise<void> {
    await this.server.setApiBaseUrl(this.manualUrl());
    this.manualUrl.set('');
    await this.server.discover();
  }

  connectToWeb(): void {
    this.error.set(null);
    const base = this.server.apiBaseUrl();
    if (!base) {
      this.error.set('configurá primero la URL del servidor');
      return;
    }

    this.connecting.set(true);
    this.http
      .post<{ deviceId: string; status: string }>(`${base}/edge/connect`, {
        deviceId: this.edgeNodeId(),
      })
      .subscribe({
        next: (res) => {
          this.paired.set(res.status === 'paired');
          this.pairStore.setPaired(res.deviceId);
          this.connecting.set(false);
        },
        error: (err) => {
          this.connecting.set(false);
          this.error.set(
            `no se pudo conectar con ${base}\nstatus: ${err?.status ?? 'sin respuesta'}`,
          );
        },
      });
  }

  goToDashboard(): void {
    this.pairStore.setPaired(this.edgeNodeId());
    this.router.navigate(['/dashboard']);
  }

  async forgetPairing(): Promise<void> {
    await this.pairStore.unpairFromServer(this.edgeNodeId());
    this.paired.set(false);
  }
}
