import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { HudPanelComponent } from '@servidor/ui-components';
import { ServerConfigService } from '../../core/config/server-config.service';
import { ContentService } from '../../core/content/content.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';

interface HealthResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

interface EdgeStatusResponse {
  paired: boolean;
  pairedAt: string | null;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, HudPanelComponent],
  template: `
    <hud-panel [title]="content.t('settings', 'title', 'Ajustes del nodo')">
      <div class="terminal">
        <div class="terminal__line">&gt; edge-node --config</div>
        <div class="terminal__line">&gt; API {{ server.apiBaseUrl() }}</div>
        <div class="terminal__line">&gt; health {{ health()?.status ?? 'sin respuesta' }}</div>
        <div class="terminal__line">&gt; paired {{ edgeStatus()?.paired ?? false }}</div>
        <div class="terminal__line">&gt; deviceId {{ pairing.deviceId() ?? 'sin emparejar' }}</div>
      </div>

      <hud-panel [title]="content.t('settings', 'serverPanel', 'Servidor')">
        <div class="server">
          <div class="server__row">
            <span class="server__label">api:</span>
            <span class="server__url">{{ server.apiBaseUrl() }}</span>
            <button class="server__btn" (click)="toggleEdit()">
              {{ editing() ? 'cerrar' : 'cambiar' }}
            </button>
          </div>

          <div class="server__status">
            @if (server.discovering()) {
              <span>descubriendo…</span>
            } @else if (health()) {
              <span class="ok">backend en línea</span>
            } @else {
              <span class="warn">sin respuesta del backend</span>
            }
          </div>

          @if (editing()) {
            <div class="server__edit">
              <input
                class="server__input"
                type="text"
                placeholder="https://servidorandroid.seenode.app/api"
                [value]="draft()"
                (input)="onDraftInput($event)"
              />
              <div class="server__actions">
                <button class="server__cta" (click)="save()">guardar</button>
                <button class="server__cta server__cta--ghost" (click)="reset()">default</button>
                <button class="server__cta server__cta--ghost" (click)="refresh()">redescubrir</button>
              </div>
            </div>
          }
        </div>
      </hud-panel>
    </hud-panel>
  `,
  styles: [`
    .terminal {
      font-family: 'JetBrains Mono', monospace;
      color: #39ff88;
      background: #05070a;
      padding: 16px;
      border: 1px solid #1c2530;
      margin-bottom: 16px;
    }
    .terminal__line { line-height: 1.7; }
    .server {
      font-family: 'JetBrains Mono', monospace;
      color: #d7dee3;
      padding: 16px;
    }
    .server__row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }
    .server__label { color: #ff7a1a; }
    .server__url { flex: 1; word-break: break-all; }
    .server__btn {
      background: transparent;
      border: 1px solid #1c2530;
      color: #5c6773;
      font-family: inherit;
      font-size: 11px;
      padding: 4px 8px;
      cursor: pointer;
    }
    .server__status {
      margin-top: 8px;
      font-size: 11px;
      color: #5c6773;
    }
    .ok { color: #39ff88; }
    .warn { color: #ffaa1a; }
    .server__edit {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
    }
    .server__input {
      background: #05070a;
      border: 1px solid #1c2530;
      color: #d7dee3;
      padding: 10px;
      font-family: inherit;
      font-size: 12px;
    }
    .server__actions {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .server__cta {
      background: #ff7a1a;
      color: #05070a;
      border: none;
      padding: 10px;
      font-family: inherit;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      cursor: pointer;
    }
    .server__cta--ghost {
      background: transparent;
      color: #5c6773;
      border: 1px solid #1c2530;
    }
  `],
})
export class SettingsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly server = inject(ServerConfigService);
  readonly content = inject(ContentService);
  readonly pairing = inject(PairingStoreService);

  readonly editing = signal(false);
  readonly draft = signal('');
  readonly health = signal<HealthResponse | null>(null);
  readonly edgeStatus = signal<EdgeStatusResponse | null>(null);

  ngOnInit(): void {
    void this.refresh();
  }

  toggleEdit(): void {
    this.editing.update((value) => !value);
    if (this.editing()) {
      this.draft.set(this.server.apiBaseUrl());
    }
  }

  onDraftInput(ev: Event): void {
    this.draft.set((ev.target as HTMLInputElement).value);
  }

  async save(): Promise<void> {
    await this.server.setApiBaseUrl(this.draft());
    this.editing.set(false);
    await this.refresh();
  }

  async reset(): Promise<void> {
    await this.server.reset();
    this.draft.set(this.server.apiBaseUrl());
    await this.refresh();
  }

  async refresh(): Promise<void> {
    await this.server.autoDiscover();
    this.loadHealth();
    this.loadEdgeStatus();
  }

  private loadHealth(): void {
    const base = this.server.apiBaseUrl();
    if (!base) return;
    this.http.get<HealthResponse>(`${base}/health`).subscribe({
      next: (health) => this.health.set(health),
      error: () => this.health.set(null),
    });
  }

  private loadEdgeStatus(): void {
    const base = this.server.apiBaseUrl();
    const deviceId = this.pairing.deviceId();
    if (!base || !deviceId) {
      this.edgeStatus.set(null);
      return;
    }
    this.http.get<EdgeStatusResponse>(`${base}/edge/status/${deviceId}`).subscribe({
      next: (status) => this.edgeStatus.set(status),
      error: () => this.edgeStatus.set(null),
    });
  }
}
