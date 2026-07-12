import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ServerConfigService } from '../../core/config/server-config.service';
import { NetworkStatusService } from '../../core/network/network-status.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="s">
      <h2 class="s__title">&gt; ajustes</h2>

      <section class="s__group">
        <div class="s__row">
          <span class="s__label">servidor</span>
          <span class="s__val">{{ server.apiBaseUrl() || '—' }}</span>
        </div>
        <div class="s__row">
          <span class="s__label">vinculado</span>
          <span class="s__val">{{ pair.isPaired() ? pair.deviceId() : 'no' }}</span>
        </div>
        <div class="s__row">
          <span class="s__label">versión</span>
          <span class="s__val">0.1.0</span>
        </div>
      </section>

      <button class="cta cta--ghost" (click)="clearPairing()">
        olvidar vinculación
      </button>
      <button class="cta cta--ghost" (click)="clearServer()">
        usar API desplegada
      </button>
      <button class="cta cta--dashboard" (click)="goToDashboard()">
        ir al dashboard
      </button>
    </div>
  `,
  styles: [
    `
      .s {
        background: #05070a;
        color: #d7dee3;
        padding: 16px;
        font-family: 'JetBrains Mono', monospace;
      }
      .s__title {
        color: #ff7a1a;
        font-size: 16px;
        margin: 0 0 16px;
      }
      .s__group {
        background: #0a0e14;
        border: 1px solid #1c2530;
        margin-bottom: 12px;
      }
      .s__row {
        display: flex;
        justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid #1c2530;
        font-size: 11px;
      }
      .s__row:last-child { border-bottom: none; }
      .s__label { color: #ff7a1a; text-transform: uppercase; letter-spacing: 1px; }
      .s__val { color: #d7dee3; word-break: break-all; max-width: 60%; text-align: right; }
      .s__val--ok { color: #39ff88; }
      .s__val--err { color: #ff4444; }
      .cta {
        width: 100%;
        background: transparent;
        color: #5c6773;
        border: 1px solid #1c2530;
        padding: 12px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        cursor: pointer;
        margin-bottom: 8px;
      }
      .cta--dashboard {
        background: #ff7a1a;
        color: #05070a;
        border-color: #ff7a1a;
      }
    `,
  ],
})
export class SettingsComponent {
  readonly server = inject(ServerConfigService);
  readonly net = inject(NetworkStatusService);
  readonly pair = inject(PairingStoreService);
  private readonly router = inject(Router);

  clearPairing(): void {
    void this.pair.unpairFromServer().then(() => {
      void this.router.navigate(['/boot']);
    });
  }

  async clearServer(): Promise<void> {
    await this.pair.unpairFromServer();
    await this.server.reset();
    await this.router.navigate(['/boot']);
  }

  goToDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }
}
