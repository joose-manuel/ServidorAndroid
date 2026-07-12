import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { HudPanelComponent, CmdButtonComponent } from '@servidor/ui-components';
import { ServerConfigService } from '../../core/config/server-config.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';
import { ContentService } from '../../core/content/content.service';

interface NetworkAuditResult {
  edgeNodeId?: string;
  scannedAt: string;
  durationMs: number;
}

@Component({
  selector: 'app-network-audit',
  standalone: true,
  imports: [CommonModule, HudPanelComponent, CmdButtonComponent, DatePipe],
  template: `
    <hud-panel [title]="content.t('audit', 'title', 'Auditoría de red')">
      @if (!pairing.deviceId()) {
        <div class="terminal terminal--muted">empareja la web con el edge para disparar o revisar auditorías.</div>
      } @else {
        <div class="terminal">
          <div class="terminal__line">&gt; edge-scan --device {{ pairing.deviceId() }}</div>
          <div class="terminal__line">&gt; último escaneo: {{ lastScan()?.scannedAt ? (lastScan()!.scannedAt | date:'HH:mm:ss dd/MM') : 'sin registros' }}</div>
          <div class="terminal__line">&gt; duración: {{ lastScan()?.durationMs ?? '—' }} ms</div>
        </div>

        <div class="actions">
          <cmd-button primary (cmdClick)="scan()" [disabled]="busy()">Escanear ahora</cmd-button>
          <cmd-button (cmdClick)="loadLastScan()" [disabled]="busy()">Actualizar</cmd-button>
        </div>
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
    .terminal--muted { color: #5c6773; }
    .terminal__line { line-height: 1.7; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  `],
})
export class NetworkAuditComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  readonly pairing = inject(PairingStoreService);
  readonly content = inject(ContentService);

  readonly lastScan = signal<NetworkAuditResult | null>(null);
  readonly busy = signal(false);

  ngOnInit(): void {
    this.loadLastScan();
  }

  loadLastScan(): void {
    const base = this.server.apiBaseUrl();
    const deviceId = this.pairing.deviceId();
    if (!base || !deviceId) return;
    this.http.get<NetworkAuditResult | null>(`${base}/network-audit/last/${deviceId}`).subscribe({
      next: (result) => this.lastScan.set(result),
      error: () => this.lastScan.set(null),
    });
  }

  scan(): void {
    const base = this.server.apiBaseUrl();
    const deviceId = this.pairing.deviceId();
    if (!base || !deviceId) return;
    this.busy.set(true);
    this.http.post<NetworkAuditResult>(`${base}/network-audit/scan`, { edgeNodeId: deviceId }).subscribe({
      next: (result) => {
        this.lastScan.set({ edgeNodeId: deviceId, ...result });
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
      },
    });
  }
}
