import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HudPanelComponent } from '@servidor/ui-components';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, HudPanelComponent],
  template: `
    <hud-panel title="Centro de alertas">
      <div class="terminal">
        <div class="terminal__line">&gt; edge-node --alerts</div>
        <div class="terminal__line">&gt; Alertas de latencia, dispositivos nuevos, batería baja</div>
        <div class="terminal__line">&gt; Notificaciones push vía FCM al edge node</div>
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
export class AlertsComponent {}