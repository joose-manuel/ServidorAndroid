import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { HudPanelComponent, CmdButtonComponent } from '@servidor/ui-components';
import { environment } from '../../../environments/environment';
import { ServerConfigService } from '../../core/config/server-config.service';

@Component({
  selector: 'app-modem-control',
  standalone: true,
  imports: [CommonModule, FormsModule, HudPanelComponent, CmdButtonComponent],
  template: `
    <hud-panel title="Control de módem">
      <div class="terminal">
        <div class="terminal__line">&gt; modem.connect({{ ip }})</div>
        <div class="terminal__line">&gt; status: ONLINE</div>
      </div>
      <div class="actions">
        <cmd-button primary (cmdClick)="reboot()">Reiniciar módem</cmd-button>
      </div>
    </hud-panel>
  `,
  styles: [
    `
      .terminal {
        font-family: 'JetBrains Mono', monospace;
        color: #39ff88;
        background: #05070a;
        padding: 16px;
        border: 1px solid #1c2530;
        margin-bottom: 16px;
      }
      .terminal__line {
        line-height: 1.6;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
    `,
  ],
})
export class ModemControlComponent {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  ip = environment.supabaseUrl ? '192.168.1.1' : '192.168.1.1';

  reboot(): void {
    this.http.post(`${this.server.apiBaseUrl()}/modem/reboot`, { reason: 'manual' }).subscribe();
  }
}
