import { Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ServerConfigService } from '../../core/config/server-config.service';
import { DeviceIdentityService } from '../../core/device/device-identity.service';

@Component({
  selector: 'app-intercom',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ic">
      <h2 class="ic__title">&gt; intercom</h2>
      <button
        class="ic__ptt"
        [class.ic__ptt--active]="ptt()"
        (mousedown)="start()"
        (mouseup)="stop()"
        (mouseleave)="stop()"
        (touchstart)="start()"
        (touchend)="stop()"
      >
        {{ ptt() ? 'hablando…' : 'mantener presionado para hablar' }}
      </button>
      <label class="ic__mute">
        <input type="checkbox" [checked]="remoteMuted()" (change)="toggleRemoteMute()" />
        silenciar nodo remoto
      </label>
    </div>
  `,
  styles: [
    `
      .ic {
        background: #05070a;
        color: #d7dee3;
        padding: 16px;
        font-family: 'JetBrains Mono', monospace;
      }
      .ic__title {
        color: #ff7a1a;
        font-size: 16px;
        margin: 0 0 12px;
      }
      .ic__ptt {
        width: 100%;
        background: #1c2530;
        color: #d7dee3;
        border: 1px solid #ff7a1a;
        padding: 24px;
        font-family: inherit;
        font-size: 14px;
        text-transform: uppercase;
      }
      .ic__ptt--active {
        background: #ff7a1a;
        color: #05070a;
      }
      .ic__mute {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        font-size: 12px;
        color: #5c6773;
      }
    `,
  ],
})
export class IntercomComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly deviceIdentity = inject(DeviceIdentityService);
  readonly ptt = signal(false);
  readonly remoteMuted = signal(false);
  private stream?: MediaStream;
  private sessionId?: string;

  async start(): Promise<void> {
    if (this.ptt()) return;
    if (!this.sessionId) {
      const res = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.server.apiBaseUrl()}/intercom/session`, {
          edgeNodeId: this.deviceIdentity.deviceId(),
        }),
      );
      this.sessionId = res?.id;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.ptt.set(true);
    } catch (err) {
      console.warn('mic permission denied', err);
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.ptt.set(false);
  }

  async toggleRemoteMute(): Promise<void> {
    const next = !this.remoteMuted();
    this.remoteMuted.set(next);
    if (this.sessionId) {
      await firstValueFrom(
        this.http.post(`${this.server.apiBaseUrl()}/intercom/session/${this.sessionId}/mute`, {
          remote: true,
          muted: next,
        }),
      );
    }
  }

  ngOnDestroy(): void {
    this.stop();
    if (this.sessionId) {
      this.http
        .post(`${this.server.apiBaseUrl()}/intercom/session/${this.sessionId}/end`, {})
        .subscribe();
    }
  }
}
