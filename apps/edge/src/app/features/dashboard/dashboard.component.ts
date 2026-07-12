import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { EdgeMetricsSnapshot } from '@servidor/shared-types';
import { ServerConfigService } from '../../core/config/server-config.service';
import { DeviceIdentityService } from '../../core/device/device-identity.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dash">
      <h1 class="dash__title">&gt; edge-node · live</h1>

      <div class="dash__server">
        <span class="dash__server-label">srv:</span>
        <span class="dash__server-url">{{ server.apiBaseUrl() || '— sin configurar —' }}</span>
        <button class="dash__server-btn" (click)="toggleServerEdit()">
          {{ editingServer() ? 'cerrar' : 'cambiar' }}
        </button>
      </div>

      @if (editingServer()) {
        <div class="dash__server-edit">
          <input
            class="dash__input"
            type="text"
            placeholder="http://192.168.1.X:3000/api"
            [value]="serverDraft()"
            (input)="onServerDraftInput($event)"
          />
          <button class="dash__cta" (click)="saveServer()">guardar</button>
          <button class="dash__cta dash__cta--ghost" (click)="resetServer()">
            usar default
          </button>
        </div>
      }

      <div class="dash__grid">
        <div class="cell">
          <div class="cell__label">latencia</div>
          <div class="cell__value">{{ snapshot()?.latency?.latencyMs ?? '—' }} ms</div>
        </div>
        <div class="cell">
          <div class="cell__label">batería</div>
          <div class="cell__value">{{ snapshot()?.battery?.levelPercent ?? '—' }}%</div>
        </div>
        <div class="cell">
          <div class="cell__label">dispositivos</div>
          <div class="cell__value">{{ snapshot()?.connectedDevicesCount ?? '—' }}</div>
        </div>
        <div class="cell">
          <div class="cell__label">estado</div>
          <div class="cell__value cell__value--ok">ONLINE</div>
        </div>
      </div>

      <div class="dash__actions">
        <button class="dash__action" (click)="goTo('/modem')">
          <span class="dash__action-prefix">&gt;</span> módem
        </button>
        <button class="dash__action" (click)="goTo('/camera')">
          <span class="dash__action-prefix">&gt;</span> cámara
        </button>
        <button class="dash__action" (click)="goTo('/intercom')">
          <span class="dash__action-prefix">&gt;</span> interfono
        </button>
        <button class="dash__action" (click)="goTo('/audit')">
          <span class="dash__action-prefix">&gt;</span> auditoría red
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .dash {
        background: #05070a;
        color: #d7dee3;
        padding: 16px;
        font-family: 'JetBrains Mono', monospace;
      }
      .dash__title {
        font-size: 16px;
        color: #ff7a1a;
        margin: 0 0 16px;
      }
      .dash__grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .cell {
        background: #0a0e14;
        border: 1px solid #1c2530;
        padding: 16px;
      }
      .cell__label {
        color: #5c6773;
        font-size: 11px;
        text-transform: uppercase;
      }
      .cell__value {
        font-size: 24px;
        margin-top: 8px;
      }
      .cell__value--ok {
        color: #39ff88;
      }
      .dash__server {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: #5c6773;
        margin: -8px 0 12px;
      }
      .dash__server-label {
        color: #ff7a1a;
      }
      .dash__server-url {
        flex: 1;
        word-break: break-all;
      }
      .dash__server-btn {
        background: transparent;
        border: 1px solid #1c2530;
        color: #5c6773;
        font-family: inherit;
        font-size: 10px;
        padding: 4px 8px;
        cursor: pointer;
      }
      .dash__server-edit {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }
      .dash__input {
        background: #0a0e14;
        border: 1px solid #1c2530;
        color: #d7dee3;
        padding: 10px;
        font-family: inherit;
        font-size: 12px;
      }
      .dash__actions {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-top: 20px;
      }
      .dash__action {
        background: #0a0e14;
        border: 1px solid #1c2530;
        color: #d7dee3;
        padding: 14px 12px;
        font-family: inherit;
        font-size: 12px;
        text-align: left;
        cursor: pointer;
      }
      .dash__action:active {
        border-color: #ff7a1a;
        color: #ff7a1a;
      }
      .dash__action-prefix {
        color: #ff7a1a;
        margin-right: 6px;
      }
      .dash__cta {
        background: #ff7a1a;
        color: #05070a;
        border: none;
        padding: 12px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        cursor: pointer;
      }
      .dash__cta--ghost {
        background: transparent;
        color: #5c6773;
        border: 1px solid #1c2530;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly deviceIdentity = inject(DeviceIdentityService);
  readonly server = inject(ServerConfigService);
  readonly snapshot = signal<EdgeMetricsSnapshot | null>(null);
  readonly editingServer = signal(false);
  readonly serverDraft = signal('');
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    const tick = () => {
      const base = this.server.apiBaseUrl();
      const edgeNodeId = this.deviceIdentity.deviceId();
      this.http
        .get<EdgeMetricsSnapshot>(`${base}/metrics/current/${edgeNodeId}`)
        .subscribe({
          next: (s) => this.snapshot.set(s),
          error: () => this.snapshot.set(null),
        });
    };
    tick();
    this.timer = setInterval(tick, 5000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  toggleServerEdit(): void {
    this.editingServer.update((v) => !v);
    if (this.editingServer()) {
      this.serverDraft.set(this.server.apiBaseUrl());
    }
  }

  onServerDraftInput(ev: Event): void {
    this.serverDraft.set((ev.target as HTMLInputElement).value);
  }

  async saveServer(): Promise<void> {
    await this.server.setApiBaseUrl(this.serverDraft());
    this.editingServer.set(false);
  }

  async resetServer(): Promise<void> {
    await this.server.reset();
    this.serverDraft.set(this.server.apiBaseUrl());
  }

  goTo(path: string): void {
    this.router.navigateByUrl(path);
  }
}
