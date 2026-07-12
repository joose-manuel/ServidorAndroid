import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { HudPanelComponent } from '@servidor/ui-components';
import { Alert } from '@servidor/shared-types';
import { ContentService } from '../../core/content/content.service';
import { ServerConfigService } from '../../core/config/server-config.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, HudPanelComponent, DatePipe],
  template: `
    <hud-panel [title]="content.t('alerts', 'title', 'Centro de alertas')">
      @if (!pairing.deviceId()) {
        <div class="empty">Empareja la web con un edge para ver sus alertas.</div>
      } @else if (loading()) {
        <div class="empty">cargando alertas…</div>
      } @else if (alerts().length === 0) {
        <div class="empty">sin alertas activas para este nodo.</div>
      } @else {
        <div class="list">
          @for (alert of alerts(); track alert.id) {
            <article class="item" [class.item--critical]="alert.severity === 'critical'" [class.item--warning]="alert.severity === 'warning'">
              <div class="item__head">
                <strong>{{ alert.title }}</strong>
                <span>{{ alert.createdAt | date:'HH:mm:ss dd/MM' }}</span>
              </div>
              <p class="item__body">{{ alert.message }}</p>
              <div class="item__meta">{{ alert.category }}</div>
            </article>
          }
        </div>
      }
    </hud-panel>
  `,
  styles: [`
    .empty {
      font-family: 'JetBrains Mono', monospace;
      color: #5c6773;
      background: #05070a;
      padding: 16px;
      border: 1px dashed #1c2530;
      text-align: center;
    }
    .list {
      display: grid;
      gap: 12px;
    }
    .item {
      background: #05070a;
      border: 1px solid #1c2530;
      padding: 14px;
      font-family: 'JetBrains Mono', monospace;
    }
    .item--warning { border-color: #ffaa1a; }
    .item--critical { border-color: #ff5b6e; }
    .item__head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #d7dee3;
      font-size: 12px;
      margin-bottom: 8px;
    }
    .item__body {
      margin: 0 0 8px;
      color: #b7c0c8;
      font-size: 12px;
    }
    .item__meta {
      color: #5c6773;
      font-size: 11px;
      text-transform: uppercase;
    }
  `],
})
export class AlertsComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly server = inject(ServerConfigService);
  readonly pairing = inject(PairingStoreService);
  readonly content = inject(ContentService);

  readonly alerts = signal<Alert[]>([]);
  readonly loading = signal(true);

  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.load();
    this.timer = setInterval(() => this.load(), 10000);
  }

  private load(): void {
    const base = this.server.apiBaseUrl();
    const edgeNodeId = this.pairing.deviceId();
    if (!base || !edgeNodeId) {
      this.loading.set(false);
      this.alerts.set([]);
      return;
    }

    this.loading.set(true);
    const params = new HttpParams().set('edgeNodeId', edgeNodeId);
    this.http.get<Alert[]>(`${base}/alerts`, { params }).subscribe({
      next: (alerts) => {
        this.alerts.set(alerts);
        this.loading.set(false);
      },
      error: () => {
        this.alerts.set([]);
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
