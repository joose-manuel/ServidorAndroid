import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HudPanelComponent } from '@servidor/ui-components';
import { ContentService } from '../../core/content/content.service';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, HudPanelComponent],
  template: `
    <hud-panel [title]="content.t('alerts', 'title', 'Centro de alertas')">
      <div class="terminal">
        <div class="terminal__line">&gt; {{ content.t('alerts', 'cmd', 'edge-node --alerts') }}</div>
        <div class="terminal__line">&gt; {{ content.t('alerts', 'desc1', 'Alertas de latencia, dispositivos nuevos, batería baja') }}</div>
        <div class="terminal__line">&gt; {{ content.t('alerts', 'desc2', 'Notificaciones push vía FCM al edge node') }}</div>
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
    }
    .terminal__line { line-height: 1.6; }
  `],
})
export class AlertsComponent {
  readonly content = inject(ContentService);
}
