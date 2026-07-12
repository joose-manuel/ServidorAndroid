import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkScanResult } from '@servidor/shared-types';
import { ServerConfigService } from '../../core/config/server-config.service';
import { DeviceIdentityService } from '../../core/device/device-identity.service';

/**
 * Triggers network scans on a 15-minute cadence (per docx 11.3).
 * The actual ARP/ICMP sweep runs on the Edge Node's Android networking
 * layer (Java side, exposed via a Capacitor plugin). The web side just
 * coordinates.
 */
@Component({
  selector: 'app-audit-worker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="audit">
      <h2 class="audit__title">&gt; network-audit</h2>
      <div class="audit__line">intervalo: cada {{ intervalMinutes }} min</div>
      <div class="audit__line">próximo escaneo: {{ nextScanAt() }}</div>
    </div>
  `,
  styles: [
    `
      .audit {
        background: #05070a;
        color: #d7dee3;
        padding: 16px;
        font-family: 'JetBrains Mono', monospace;
      }
      .audit__title {
        color: #ff7a1a;
        font-size: 16px;
        margin: 0 0 12px;
      }
      .audit__line {
        font-size: 12px;
        color: #5c6773;
        margin-bottom: 6px;
      }
    `,
  ],
})
export class AuditWorkerComponent implements OnInit, OnDestroy {
  private readonly server = inject(ServerConfigService);
  private readonly deviceIdentity = inject(DeviceIdentityService);
  readonly intervalMinutes = 15;
  readonly nextScanAt = signal<string>('—');
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.scheduleNext();
    this.timer = setInterval(() => this.scheduleNext(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private scheduleNext(): void {
    const next = new Date(Date.now() + this.intervalMinutes * 60_000);
    this.nextScanAt.set(next.toLocaleTimeString());
    void fetch(`${this.server.apiBaseUrl()}/network-audit/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ edgeNodeId: this.deviceIdentity.deviceId() }),
    })
      .then((r) => r.json() as Promise<NetworkScanResult>)
      .catch(() => null);
  }
}
