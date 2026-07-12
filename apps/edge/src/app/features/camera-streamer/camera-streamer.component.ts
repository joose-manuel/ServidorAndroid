import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ServerConfigService } from '../../core/config/server-config.service';
import { DeviceIdentityService } from '../../core/device/device-identity.service';

@Component({
  selector: 'app-camera-streamer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cam">
      <h2 class="cam__title">&gt; camera-streamer</h2>
      <video #video autoplay playsinline muted class="cam__video"></video>
      <div class="cam__bar">
        <button class="cam__btn" (click)="toggle()">{{ active() ? 'detener' : 'publicar' }}</button>
      </div>
    </div>
  `,
  styles: [
    `
      .cam {
        background: #05070a;
        color: #d7dee3;
        padding: 16px;
        font-family: 'JetBrains Mono', monospace;
      }
      .cam__title {
        color: #ff7a1a;
        font-size: 16px;
        margin: 0 0 12px;
      }
      .cam__video {
        width: 100%;
        aspect-ratio: 9 / 16;
        background: #000;
      }
      .cam__btn {
        background: #ff7a1a;
        color: #05070a;
        border: none;
        padding: 14px;
        font-family: inherit;
        font-weight: 700;
        width: 100%;
        text-transform: uppercase;
      }
    `,
  ],
})
export class CameraStreamerComponent implements OnDestroy {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly deviceIdentity = inject(DeviceIdentityService);
  readonly active = signal(false);
  private stream?: MediaStream;

  async toggle(): Promise<void> {
    if (this.active()) {
      this.stop();
    } else {
      await this.start();
    }
  }

  private async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      this.videoRef.nativeElement.srcObject = this.stream;
      this.active.set(true);

      // Sprint 5 — HU-10: notify the API so it can issue TURN creds
      // and complete the WebRTC handshake with the remote viewer.
      this.http
        .post(`${this.server.apiBaseUrl()}/camera/session`, {
          edgeNodeId: this.deviceIdentity.deviceId(),
          quality: 'medium',
        })
        .subscribe();
    } catch (err) {
      console.warn('camera permission denied or unavailable', err);
    }
  }

  private stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.active.set(false);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
