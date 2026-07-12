import { Component, inject, signal, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ForegroundServiceManager } from '../../core/foreground/foreground.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';
import { ServerConfigService } from '../../core/config/server-config.service';
import { DeviceIdentityService } from '../../core/device/device-identity.service';
import { NetworkStatusService } from '../../core/network/network-status.service';
import { TunnelService } from '../../core/tunnel/tunnel.service';

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

      <!-- TUNNEL: el corazón del flujo -->
      <section class="tunnel">
        <div class="tunnel__head">
          <span class="tunnel__title">tunnel público</span>
          <span class="tunnel__state" [class]="tunnelClass()">
            <span class="tunnel__dot"></span>
            {{ tunnelLabel() }}
          </span>
        </div>

        @if (tunnel.url()) {
          <div class="tunnel__urlbox">
            <code class="tunnel__url">{{ tunnel.url() }}/api</code>
            <button class="tunnel__copy" (click)="copyUrl()">
              {{ copied() ? '✓ copiado' : 'copiar' }}
            </button>
          </div>
          <p class="tunnel__hint">
            pegá esta URL en la <strong>web</strong> (Ajustes → Servidor).
            el dashboard de la web va a mostrar las métricas de este dispositivo.
          </p>
        } @else if (tunnel.error()) {
          <p class="tunnel__err">{{ tunnel.error() }}</p>
        }

        <div class="tunnel__actions">
          @if (tunnel.state() === 'running') {
            <button class="cta cta--danger" (click)="stopTunnel()">detener tunnel</button>
          } @else {
            <button
              class="cta"
              [disabled]="tunnel.state() === 'starting'"
              (click)="startTunnel()"
            >
              {{ tunnel.state() === 'starting' ? 'arrancando…' : 'crear tunnel público' }}
            </button>
          }
        </div>

        @if (showLogs()) {
          <details class="tunnel__logs" (toggle)="onLogsToggle($event)">
            <summary class="tunnel__logs-summary">logs del plugin</summary>
            <pre class="tunnel__logs-pre"><code>{{ logsText() }}</code></pre>
            <button class="cta cta--ghost cta--small" (click)="refreshLogs()">refrescar</button>
            <button class="cta cta--ghost cta--small" (click)="copyLogs()">copiar logs</button>
          </details>
        } @else {
          <button class="cta cta--ghost cta--small" (click)="showLogs.set(true); refreshLogs()">
            ver logs
          </button>
        }
      </section>

      <!-- Estado del servidor / pairing -->
      <section class="setup">
        <div class="setup__row">
          <span class="setup__label">1 · internet</span>
          <span class="setup__val" [class]="netClass()">{{ netLabel() }}</span>
        </div>
        <div class="setup__row">
          <span class="setup__label">2 · tunnel</span>
          <span class="setup__val" [class]="tunnelClass()">{{ tunnelLabel() }}</span>
        </div>
        <div class="setup__row">
          <span class="setup__label">3 · servidor</span>
          <span class="setup__val" [class]="serverClass()">{{ serverLabel() }}</span>
        </div>

        @if (tunnel.url()) {
          <div class="setup__field">
            <label class="setup__fieldlabel" for="server-url">
              URL del servidor (en este dispositivo = el tunnel)
            </label>
            <div class="setup__input-row">
              <input
                id="server-url"
                class="setup__input"
                type="text"
                [value]="tunnel.url() + '/api'"
                readonly
              />
              <button class="cta cta--ghost cta--small" (click)="useTunnelUrl()">
                usar
              </button>
            </div>
          </div>
        }

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
              @if (r.tunnelUrl) {
                <span>· tunnel activo</span>
              }
              @if (r.error) {
                <span>· {{ r.error }}</span>
              }
            </div>
          </div>
        }
      </section>

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
          } @else if (pairingCode()) {
            <div class="pair__state pair__state--wait">
              <div class="pair__label">código de vinculación</div>
              <div class="pair__code">{{ pairingCode() }}</div>
              <p class="pair__hint">ingresá este código en la web · puerto 4200</p>
              <p class="pair__hint">&gt; esperando…</p>
            </div>
          } @else if (error()) {
            <p class="pair__error">{{ error() }}</p>
            <button class="cta" (click)="showCode()">reintentar</button>
          } @else {
            <button class="cta" (click)="showCode()">conectar con la web</button>
          }
        </section>
      } @else {
        <section class="pair pair--hint">
          <p class="pair__hint">
            1 · creá el tunnel arriba · 2 · pegá la URL acá abajo · 3 · tocá conectar
          </p>
          <input
            class="setup__input"
            type="text"
            placeholder="https://xxxx.trycloudflare.com/api"
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

      .tunnel {
        background: #0a0e14;
        border: 2px solid #ff7a1a;
        padding: 14px;
      }
      .tunnel__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .tunnel__title {
        color: #ff7a1a;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .tunnel__state {
        font-size: 10px;
        display: flex;
        align-items: center;
        gap: 6px;
        color: #5c6773;
      }
      .tunnel__dot {
        width: 8px; height: 8px; border-radius: 50%; background: #5c6773;
      }
      .tunnel__state--running { color: #39ff88; }
      .tunnel__state--running .tunnel__dot { background: #39ff88; }
      .tunnel__state--starting { color: #ffaa1a; }
      .tunnel__state--starting .tunnel__dot { background: #ffaa1a; animation: pulse 1s infinite; }
      .tunnel__state--error { color: #ff4444; }
      .tunnel__state--error .tunnel__dot { background: #ff4444; }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      .tunnel__urlbox {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #05070a;
        border: 1px solid #1c2530;
        padding: 10px;
        margin-bottom: 8px;
      }
      .tunnel__url {
        flex: 1;
        color: #39ff88;
        font-size: 12px;
        word-break: break-all;
        background: transparent;
        border: none;
      }
      .tunnel__copy {
        background: #ff7a1a;
        color: #05070a;
        border: none;
        padding: 6px 12px;
        font-family: inherit;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        cursor: pointer;
      }
      .tunnel__hint {
        color: #5c6773;
        font-size: 10px;
        line-height: 1.5;
        margin: 0 0 12px;
      }
      .tunnel__hint strong { color: #d7dee3; }
      .tunnel__err {
        color: #ff4444;
        font-size: 11px;
        margin: 0 0 12px;
      }
      .tunnel__actions { margin-top: 4px; }

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
      .pair__label {
        color: #5c6773; font-size: 11px; text-transform: uppercase;
        letter-spacing: 1px; margin-bottom: 8px;
      }
      .pair__code {
        font-size: 48px; font-weight: 700; color: #39ff88;
        letter-spacing: 8px; margin: 8px 0; word-break: break-all;
      }
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
      .cta--small { padding: 10px 14px; font-size: 11px; }
      .cta--ghost {
        background: transparent; color: #5c6773; border: 1px solid #1c2530;
      }
      .cta--link {
        background: transparent; color: #5c6773; border: none;
        font-size: 11px; text-decoration: underline; margin-top: 8px;
      }
      .cta--danger { background: #ff4444; color: #fff; }
      .tunnel__logs { margin-top: 12px; }
      .tunnel__logs-summary {
        color: #ff7a1a; font-size: 11px; cursor: pointer; user-select: none;
        font-family: inherit;
      }
      .tunnel__logs-pre {
        background: #05070a; border: 1px solid #1c2530; padding: 8px;
        font-size: 9px; max-height: 300px; overflow: auto; margin: 8px 0;
        white-space: pre-wrap; word-break: break-all;
      }
      .tunnel__logs-pre code { color: #5c6773; }
    `,
  ],
})
export class BootComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly fg = inject(ForegroundServiceManager);
  private readonly pairStore = inject(PairingStoreService);
  private readonly deviceIdentity = inject(DeviceIdentityService);
  readonly server = inject(ServerConfigService);
  readonly net = inject(NetworkStatusService);
  readonly tunnel = inject(TunnelService);

  readonly pairingCode = signal<string | null>(null);
  readonly paired = signal(this.pairStore.isPaired());
  readonly error = signal<string | null>(null);
  readonly edgeNodeId = this.deviceIdentity.deviceId;
  readonly manualUrl = signal('');
  readonly copied = signal(false);
  readonly showLogs = signal(false);
  readonly logsText = signal('');
  private pollTimer?: ReturnType<typeof setInterval>;
  private copiedTimer?: ReturnType<typeof setTimeout>;
  private autoCopied = false;

  constructor() {
    this.fg.start().catch((err) => console.warn('[fg]', err));
    this.net.start();
    void this.tunnel.refresh();

    effect(() => {
      const u = this.tunnel.url();
      if (u && !this.autoCopied) {
        this.autoCopied = true;
        this.tunnel.copyUrl().then((ok) => {
          if (ok) {
            this.copied.set(true);
            if (this.copiedTimer) clearTimeout(this.copiedTimer);
            this.copiedTimer = setTimeout(() => this.copied.set(false), 2000);
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.net.stop();
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
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

  tunnelClass(): string {
    const s = this.tunnel.state();
    return s === 'running' || s === 'starting' || s === 'error'
      ? `tunnel__state--${s}`
      : '';
  }

  tunnelLabel(): string {
    const s = this.tunnel.state();
    if (s === 'running') return 'activo · listo para copiar';
    if (s === 'starting') return 'arrancando…';
    if (s === 'error') return 'error';
    return 'detenido';
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
    if (d.state === 'ok') return d.tunnelUrl ? 'ok · tunnel activo' : 'ok';
    if (d.state === 'fail') return `falló · ${d.error ?? '?'}`;
    return 'probando…';
  }

  resultClass(s: 'ok' | 'fail' | 'checking'): string {
    return `setup__result setup__result--${s}`;
  }

  async startTunnel(): Promise<void> {
    await this.tunnel.start(3000);
  }

  async stopTunnel(): Promise<void> {
    await this.tunnel.stop();
  }

  async copyUrl(): Promise<void> {
    const ok = await this.tunnel.copyUrl();
    if (ok) {
      this.copied.set(true);
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.copied.set(false), 2000);
    }
  }

  async refreshLogs(): Promise<void> {
    this.logsText.set(await this.tunnel.getLogs());
  }

  async copyLogs(): Promise<void> {
    const text = this.logsText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  onLogsToggle(ev: Event): void {
    const details = ev.target as HTMLDetailsElement;
    if (details.open) {
      void this.refreshLogs();
    }
  }

  async useTunnelUrl(): Promise<void> {
    const u = this.tunnel.url();
    if (!u) return;
    await this.server.setApiBaseUrl(u + '/api');
    await this.server.discover();
  }

  onManualUrlInput(ev: Event): void {
    this.manualUrl.set((ev.target as HTMLInputElement).value);
  }

  async useManualUrl(): Promise<void> {
    await this.server.setApiBaseUrl(this.manualUrl());
    this.manualUrl.set('');
    await this.server.discover();
  }

  showCode(): void {
    this.error.set(null);
    const base = this.server.apiBaseUrl();
    if (!base) {
      this.error.set('configurá primero la URL del servidor');
      return;
    }
    this.http
      .post<{ code: string; deviceId: string }>(`${base}/edge/register`, {
        deviceId: this.edgeNodeId(),
      })
      .subscribe({
        next: (res) => {
          this.pairingCode.set(res.code);
          this.startPolling();
        },
        error: (err) => {
          this.error.set(
            `no se pudo conectar con ${base}\nstatus: ${err?.status ?? 'sin respuesta'}`,
          );
        },
      });
  }

  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      const base = this.server.apiBaseUrl();
      this.http
        .get<{ paired: boolean }>(`${base}/edge/status/${this.edgeNodeId()}`)
        .subscribe((res) => {
          if (res.paired) {
            this.paired.set(true);
            this.pairingCode.set(null);
            this.pairStore.setPaired(this.edgeNodeId());
            this.stopPolling();
          }
        });
    }, 3000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  goToDashboard(): void {
    this.pairStore.setPaired(this.edgeNodeId());
    this.router.navigate(['/dashboard']);
  }

  forgetPairing(): void {
    this.pairStore.clear();
    this.paired.set(false);
    this.pairingCode.set(null);
  }
}
