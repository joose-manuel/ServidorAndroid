import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HudPanelComponent, CmdButtonComponent } from '@servidor/ui-components';
import { ContentService } from '../../core/content/content.service';

@Component({
  selector: 'app-intercom',
  standalone: true,
  imports: [CommonModule, HudPanelComponent, CmdButtonComponent],
  template: `
    <hud-panel [title]="content.t('intercom', 'title', 'Interfono bidireccional')">
      <div class="terminal">
        <div class="terminal__line">&gt; {{ content.t('intercom', 'cmdInit', 'intercom --session iniciar') }}</div>
        <div class="terminal__line">&gt; {{ content.t('intercom', 'desc1', 'Audio bidireccional WebRTC con el edge node') }}</div>
        <div class="terminal__line">&gt; {{ content.t('intercom', 'desc2', 'El celular Samsung S9 actúa como interfono IP') }}</div>
      </div>
      <div class="actions">
        <cmd-button primary (cmdClick)="openIntercom()">{{ content.t('intercom', 'startBtn', 'Iniciar intercom') }}</cmd-button>
      </div>
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
    .terminal__line { line-height: 1.6; }
    .actions { display: flex; gap: 8px; }
  `],
})
export class IntercomComponent {
  readonly content = inject(ContentService);

  openIntercom(): void {
    // Sprint 6 — WebRTC audio con TURN credentials desde POST /api/intercom/session
  }
}
