import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HudPanelComponent, StatusBadgeComponent, CmdButtonComponent } from '@servidor/ui-components';
import { ContentService } from '../../core/content/content.service';

@Component({
  selector: 'app-camera',
  standalone: true,
  imports: [CommonModule, HudPanelComponent, StatusBadgeComponent, CmdButtonComponent],
  template: `
    <hud-panel [title]="content.t('camera', 'title', 'Cámara remota')">
      <div class="viewer">
        <div class="viewer__placeholder">
          <span class="viewer__icon">📷</span>
          <span>{{ content.t('camera', 'live', 'Transmisión en vivo desde el edge node') }}</span>
          <span class="viewer__hint">{{ content.t('camera', 'hint', 'WebRTC con TURN/STUN — requiere sesión activa') }}</span>
        </div>
      </div>
      <div class="actions">
        <cmd-button primary (cmdClick)="openCamera()">{{ content.t('camera', 'startBtn', 'Iniciar cámara') }}</cmd-button>
      </div>
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
    }
    .viewer__placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: #5c6773;
      font-family: 'JetBrains Mono', monospace;
    }
    .viewer__icon { font-size: 32px; }
    .viewer__hint { font-size: 11px; color: #3a4350; }
    .actions { display: flex; gap: 8px; }
  `],
})
export class CameraComponent {
  readonly content = inject(ContentService);

  openCamera(): void {
    // Sprint 5 — WebRTC con TURN credentials desde POST /api/camera/session
  }
}
