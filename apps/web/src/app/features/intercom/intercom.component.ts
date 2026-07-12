import { Component, inject, signal } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { HudPanelComponent, CmdButtonComponent } from '@servidor/ui-components';
import { ContentService } from '../../core/content/content.service';
import { ServerConfigService } from '../../core/config/server-config.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';

interface IntercomSessionResponse {
  id: string;
  edgeNodeId: string;
  startedAt: string;
  status: string;
  remoteMuted: boolean;
  localMuted: boolean;
}

@Component({
  selector: 'app-intercom',
  standalone: true,
  imports: [CommonModule, HudPanelComponent, CmdButtonComponent, JsonPipe],
  template: `
    <hud-panel [title]="content.t('intercom', 'title', 'Interfono bidireccional')">
      <div class="terminal">
        @if (session()) {
          <div class="terminal__line">&gt; sesión {{ session()!.id }}</div>
          <div class="terminal__line">&gt; estado {{ session()!.status }}</div>
          <div class="terminal__line">&gt; remoteMuted {{ session()!.remoteMuted }}</div>
          <div class="terminal__line">&gt; localMuted {{ session()!.localMuted }}</div>
        } @else {
          <div class="terminal__line">&gt; {{ content.t('intercom', 'cmdInit', 'intercom --session iniciar') }}</div>
          <div class="terminal__line">&gt; {{ content.t('intercom', 'desc1', 'Audio bidireccional WebRTC con el edge node') }}</div>
          <div class="terminal__line">&gt; {{ content.t('intercom', 'desc2', 'La web ya crea la sesión en la API') }}</div>
        }
      </div>
      <div class="actions">
        <cmd-button primary (cmdClick)="openIntercom()">Iniciar intercom</cmd-button>
      </div>
      @if (session()) {
        <pre class="debug">{{ session() | json }}</pre>
      }
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
    .actions { display: flex; gap: 8px; }
    .debug {
      margin-top: 16px;
      background: #05070a;
      border: 1px solid #1c2530;
      padding: 12px;
      color: #5c6773;
      font-size: 11px;
      overflow: auto;
    }
  `],
})
export class IntercomComponent {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly pairing = inject(PairingStoreService);
  readonly content = inject(ContentService);

  readonly session = signal<IntercomSessionResponse | null>(null);

  openIntercom(): void {
    const base = this.server.apiBaseUrl();
    const edgeNodeId = this.pairing.deviceId();
    if (!base || !edgeNodeId) return;
    this.http.post<IntercomSessionResponse>(`${base}/intercom/session`, { edgeNodeId }).subscribe({
      next: (session) => this.session.set(session),
      error: () => this.session.set(null),
    });
  }
}
