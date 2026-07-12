import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { HudPanelComponent, CmdButtonComponent } from '@servidor/ui-components';
import { ServerConfigService } from '../../core/config/server-config.service';
import { ContentService } from '../../core/content/content.service';

interface ModemStatusResponse {
  state: 'online';
  modemIp: string;
  lastRebootAt: string | null;
  lastReason: string | null;
}

interface ModemRebootResponse {
  ok: true;
  sentAt: string;
}

@Component({
  selector: 'app-modem-control',
  standalone: true,
  imports: [CommonModule, HudPanelComponent, CmdButtonComponent, DatePipe],
  template: `
    <hud-panel [title]="content.t('modem', 'title', 'Control de módem')">
      @if (status()) {
        <div class="terminal">
          <div class="terminal__line">&gt; modem.connect({{ status()!.modemIp }})</div>
          <div class="terminal__line">&gt; status: {{ status()!.state.toUpperCase() }}</div>
          <div class="terminal__line">&gt; último reinicio: {{ status()!.lastRebootAt ? (status()!.lastRebootAt | date:'HH:mm:ss dd/MM') : 'sin registros' }}</div>
          <div class="terminal__line">&gt; motivo: {{ status()!.lastReason ?? '—' }}</div>
        </div>
      } @else {
        <div class="terminal terminal--muted">no se pudo obtener el estado del módem desde la API</div>
      }

      @if (lastAction()) {
        <div class="result">reinicio enviado a las {{ lastAction()!.sentAt | date:'HH:mm:ss' }}</div>
      }

      <div class="actions">
        <cmd-button primary (cmdClick)="reboot()" [disabled]="busy()">Reiniciar módem</cmd-button>
        <cmd-button (cmdClick)="loadStatus()" [disabled]="busy()">Actualizar estado</cmd-button>
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
    .terminal--muted { color: #5c6773; }
    .terminal__line { line-height: 1.7; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .result {
      color: #d7dee3;
      font-family: 'JetBrains Mono', monospace;
      margin-bottom: 12px;
      font-size: 12px;
    }
  `],
})
export class ModemControlComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  readonly content = inject(ContentService);

  readonly status = signal<ModemStatusResponse | null>(null);
  readonly lastAction = signal<ModemRebootResponse | null>(null);
  readonly busy = signal(false);

  ngOnInit(): void {
    this.loadStatus();
  }

  loadStatus(): void {
    const base = this.server.apiBaseUrl();
    if (!base) return;
    this.http.get<ModemStatusResponse>(`${base}/modem/status`).subscribe({
      next: (status) => this.status.set(status),
      error: () => this.status.set(null),
    });
  }

  reboot(): void {
    const base = this.server.apiBaseUrl();
    if (!base) return;
    this.busy.set(true);
    this.http.post<ModemRebootResponse>(`${base}/modem/reboot`, { reason: 'manual desde web' }).subscribe({
      next: (response) => {
        this.lastAction.set(response);
        this.busy.set(false);
        this.loadStatus();
      },
      error: () => {
        this.busy.set(false);
      },
    });
  }
}
