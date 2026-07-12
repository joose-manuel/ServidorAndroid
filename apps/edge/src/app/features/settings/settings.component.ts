import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ServerConfigService } from '../../core/config/server-config.service';
import { DeviceInfoService } from '../../core/device/device-info.service';
import { NetworkStatusService } from '../../core/network/network-status.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';
import { SpeedTestService } from '../speedtest/speedtest.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
        <div class="s__row">
          <span class="s__label">temperatura</span>
          <span class="s__val">
            {{ deviceInfo.current().temperatureC !== null ? (deviceInfo.current().temperatureC + ' °C') : 'sin lectura' }}
          </span>
        </div>
        <div class="s__row">
          <span class="s__label">modelo</span>
          <span class="s__val">{{ deviceInfo.current().model ?? 'sin detectar' }}</span>
        </div>
      </section>

      <section class="s__group s__group--form">
        <h3 class="s__section-title">mediciones automáticas</h3>

        <div class="s__grid">
          <label class="s__field">
            <span class="s__field-label">intervalo (segundos)</span>
            <input
              class="s__input"
              type="number"
              min="5"
              max="86400"
              [ngModel]="speed.config().intervalSec"
              (ngModelChange)="onIntervalChange($event)"
            />
            <span class="s__hint">cada cuánto se repite la medición automática</span>
          </label>

          <label class="s__field">
            <span class="s__field-label">duración (segundos)</span>
            <input
              class="s__input"
              type="number"
              min="2"
              max="3600"
              [ngModel]="speed.config().durationSec"
              (ngModelChange)="onDurationChange($event)"
            />
            <span class="s__hint">cuánto dura cada prueba de descarga y subida</span>
          </label>
        </div>

        <label class="s__field">
          <span class="s__field-label">hora fija diaria</span>
          <input
            class="s__input"
            type="time"
            [ngModel]="speed.config().scheduledTimeLocal ?? ''"
            (ngModelChange)="onScheduledTimeChange($event)"
          />
          <span class="s__hint">
            dejalo vacío si solo quieres mediciones por intervalo
          </span>
        </label>

        <div class="s__row s__row--inline">
          <span class="s__label">próxima medición fija</span>
          <span class="s__val">{{ nextScheduledLabel() }}</span>
        </div>
      </section>

      <section class="s__group s__group--form">
        <h3 class="s__section-title">identidad del dispositivo</h3>

        <label class="s__field">
          <span class="s__field-label">nombre del dispositivo</span>
          <input
            class="s__input"
            type="text"
            [ngModel]="deviceInfo.current().customName ?? ''"
            (ngModelChange)="onDeviceNameChange($event)"
            placeholder="ej. edge sala"
          />
          <span class="s__hint">este nombre se enviará al backend y se verá también en la web</span>
        </label>

        <div class="s__row s__row--inline">
          <span class="s__label">nombre enviado</span>
          <span class="s__val">{{ deviceInfo.current().deviceName }}</span>
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
      .s__group--form {
        padding: 12px;
      }
      .s__section-title {
        margin: 0 0 12px;
        color: #ff7a1a;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .s__row {
        display: flex;
        justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid #1c2530;
        font-size: 11px;
      }
      .s__row:last-child { border-bottom: none; }
      .s__row--inline {
        padding: 10px 0 0;
        border-bottom: none;
      }
      .s__label { color: #ff7a1a; text-transform: uppercase; letter-spacing: 1px; }
      .s__val { color: #d7dee3; word-break: break-all; max-width: 60%; text-align: right; }
      .s__val--ok { color: #39ff88; }
      .s__val--err { color: #ff4444; }
      .s__grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .s__field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 12px;
      }
      .s__field-label {
        color: #ff7a1a;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .s__input {
        width: 100%;
        box-sizing: border-box;
        background: #05070a;
        border: 1px solid #1c2530;
        color: #d7dee3;
        padding: 10px;
        font-family: inherit;
        font-size: 13px;
      }
      .s__input:focus {
        outline: none;
        border-color: #ff7a1a;
      }
      .s__hint {
        color: #5c6773;
        font-size: 10px;
        line-height: 1.4;
      }
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
      @media (max-width: 720px) {
        .s__grid {
          grid-template-columns: 1fr;
        }
        .s__val {
          max-width: 55%;
        }
      }
    `,
  ],
})
export class SettingsComponent {
  readonly server = inject(ServerConfigService);
  readonly net = inject(NetworkStatusService);
  readonly pair = inject(PairingStoreService);
  readonly speed = inject(SpeedTestService);
  readonly deviceInfo = inject(DeviceInfoService);
  private readonly router = inject(Router);
  readonly nextScheduledLabel = computed(() => {
    const next = this.speed.nextScheduledAt();
    return next ? next.toLocaleString() : 'desactivada';
  });

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

  onIntervalChange(value: number | string): void {
    this.speed.setConfig({ intervalSec: Math.max(5, Number(value) || 20) });
  }

  onDurationChange(value: number | string): void {
    this.speed.setConfig({ durationSec: Math.max(2, Number(value) || 4) });
  }

  onScheduledTimeChange(value: string): void {
    this.speed.setConfig({ scheduledTimeLocal: value?.trim() ? value.trim() : null });
  }

  onDeviceNameChange(value: string): void {
    this.deviceInfo.setCustomName(value);
  }
}
