import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HudPanelComponent, StatusBadgeComponent, CmdButtonComponent } from '@servidor/ui-components';

@Component({
  selector: 'app-camera',
  standalone: true,
  imports: [CommonModule, HudPanelComponent, StatusBadgeComponent, CmdButtonComponent],
  template: `
    <hud-panel title="Cámara remota">
      <div class="viewer">
        <div class="viewer__placeholder">
          <span class="viewer__icon">📷</span>
          <span>Transmisión en vivo desde el edge node</span>
          <span class="viewer__hint">WebRTC con TURN/STUN — requiere sesión activa</span>
        </div>
      </div>
      <div class="actions">
        <cmd-button primary (cmdClick)="openCamera()">Iniciar cámara</cmd-button>
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
  openCamera(): void {
    // Sprint 5 — WebRTC con TURN credentials desde POST /api/camera/session
  }
}