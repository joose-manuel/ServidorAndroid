import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { HudPanelComponent, CmdButtonComponent } from '@servidor/ui-components';
import { ServerConfigService } from '../../core/config/server-config.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';
import { ContentService } from '../../core/content/content.service';

@Component({
  selector: 'app-network-audit',
  standalone: true,
  imports: [CommonModule, HudPanelComponent, CmdButtonComponent],
  template: `
    <hud-panel [title]="content.t('audit', 'title', 'Auditoría de red')">
      <div class="terminal">
        <div class="terminal__line">&gt; {{ content.t('audit', 'scanCmd', 'edge-scan --network 192.168.1.0/24') }}</div>
        <div class="terminal__line">&gt; {{ content.t('audit', 'desc1', 'El edge node escanea la red LAN cada 15 minutos') }}</div>
        <div class="terminal__line">&gt; {{ content.t('audit', 'desc2', 'detecta dispositivos por ARP + ICMP ping') }}</div>
      </div>
      <div class="actions">
        <cmd-button primary (cmdClick)="scan()">{{ content.t('audit', 'scanBtn', 'Escanear ahora') }}</cmd-button>
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
export class NetworkAuditComponent {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly pairing = inject(PairingStoreService);
  readonly content = inject(ContentService);

  scan(): void {
    const deviceId = this.pairing.deviceId();
    if (!deviceId) return;
    this.http
      .post(`${this.server.apiBaseUrl()}/network-audit/scan`, { edgeNodeId: deviceId })
      .subscribe({ error: () => {} });
  }
}
