import { Component, inject, signal } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { HudPanelComponent, CmdButtonComponent } from '@servidor/ui-components';
import { ContentService } from '../../core/content/content.service';
import { ServerConfigService } from '../../core/config/server-config.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';

interface CameraSessionResponse {
  session: {
    id: string;
    edgeNodeId: string;
    startedAt: string;
    facing: 'front' | 'back';
    status: string;
    encrypted: boolean;
  };
  turn: {
    urls: string[];
    username: string;
    credential: string;
    ttlSeconds: number;
  };
}

@Component({
  selector: 'app-camera',
  standalone: true,
  imports: [CommonModule, HudPanelComponent, CmdButtonComponent, JsonPipe],
  template: `
    <hud-panel [title]="content.t('camera', 'title', 'Cámara remota')">
      <div class="viewer">
        @if (session()) {
          <div class="viewer__session">
            <strong>sesión {{ session()!.session.id }}</strong>
            <span>estado {{ session()!.session.status }}</span>
            <span>facing {{ session()!.session.facing }}</span>
            <span>turn {{ session()!.turn.urls[0] ?? '—' }}</span>
          </div>
        } @else {
          <div class="viewer__placeholder">
            <span class="viewer__icon">📷</span>
            <span>{{ content.t('camera', 'live', 'Transmisión en vivo desde el edge node') }}</span>
            <span class="viewer__hint">{{ content.t('camera', 'hint', 'La web ya crea la sesión en la API. Falta completar el viewer WebRTC final.') }}</span>
          </div>
        }
      </div>
      <div class="actions">
        <cmd-button primary (cmdClick)="openCamera()">Iniciar cámara</cmd-button>
      </div>
      @if (session()) {
        <pre class="debug">{{ session() | json }}</pre>
      }
    </hud-panel>
  `,
  styles: [`
    .viewer {
      aspect-ratio: 16 / 9;
      background: #05070a;
      border: 1px solid #1c2530;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      padding: 16px;
    }
    .viewer__placeholder,
    .viewer__session {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: #5c6773;
      font-family: 'JetBrains Mono', monospace;
      text-align: center;
    }
    .viewer__session { color: #d7dee3; }
    .viewer__icon { font-size: 32px; }
    .viewer__hint { font-size: 11px; color: #3a4350; }
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
export class CameraComponent {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly pairing = inject(PairingStoreService);
  readonly content = inject(ContentService);

  readonly session = signal<CameraSessionResponse | null>(null);

  openCamera(): void {
    const base = this.server.apiBaseUrl();
    const edgeNodeId = this.pairing.deviceId();
    if (!base || !edgeNodeId) return;
    this.http
      .post<CameraSessionResponse>(`${base}/camera/session`, {
        edgeNodeId,
        quality: 'medium',
        facing: 'back',
      })
      .subscribe({
        next: (session) => this.session.set(session),
        error: () => this.session.set(null),
      });
  }
}
