import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ServerConfigService } from '../../core/config/server-config.service';
import { DeviceIdentityService } from '../../core/device/device-identity.service';
import { WebrtcSignalingService } from '../../core/webrtc/webrtc-signaling.service';

@Component({
  selector: 'app-camera-streamer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cam">
      <h2 class="cam__title">&gt; camera-streamer</h2>
      <video #video autoplay playsinline muted class="cam__video"></video>
      <div class="cam__meta">
        <span>estado {{ status() }}</span>
        <span>sesión {{ activeSessionId() ?? 'sin sesión remota' }}</span>
      </div>
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
      .cam__meta {
        display: grid;
        gap: 4px;
        font-size: 11px;
        color: #5c6773;
        margin: 12px 0;
      }
    `,
  ],
})
export class CameraStreamerComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly deviceIdentity = inject(DeviceIdentityService);
  private readonly signaling = inject(WebrtcSignalingService);
  readonly active = signal(false);
  readonly status = signal<'idle' | 'awaiting-answer' | 'streaming' | 'error'>('idle');
  readonly activeSessionId = signal<string | null>(null);
  private stream?: MediaStream;
  private peer?: RTCPeerConnection;
  private readonly viewReady = signal(false);

  constructor() {
    effect(() => {
      const request = this.signaling.pendingRequest();
      if (!request || request.mode !== 'camera' || !this.viewReady()) {
        return;
      }

      if (this.activeSessionId() === request.sessionId) {
        return;
      }

      void this.startRemoteSession(request.sessionId, request.turn?.urls ? request.turn : undefined);
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  ngOnInit(): void {
    this.signaling.answer$.subscribe((payload) => {
      if (payload.sessionId !== this.activeSessionId() || !this.peer) {
        return;
      }

      void this.peer.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit).then(() => {
        this.status.set('streaming');
      });
    });

    this.signaling.iceCandidate$.subscribe((payload) => {
      if (payload.sessionId !== this.activeSessionId() || !this.peer) {
        return;
      }

      void this.peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
    });

    this.signaling.sessionEnded$.subscribe((payload) => {
      if (payload.sessionId === this.activeSessionId()) {
        this.stop();
      }
    });
  }

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
      this.status.set('streaming');

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
      this.status.set('error');
    }
  }

  private async startRemoteSession(
    sessionId: string,
    turn?: { urls: string[]; username: string; credential: string; ttlSeconds: number },
  ): Promise<void> {
    await this.stop(false);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      this.videoRef.nativeElement.srcObject = this.stream;
      this.active.set(true);
      this.activeSessionId.set(sessionId);
      this.status.set('awaiting-answer');

      this.peer = new RTCPeerConnection({
        iceServers: turn
          ? [
              {
                urls: turn.urls,
                username: turn.username,
                credential: turn.credential,
              },
            ]
          : undefined,
      });

      this.signaling.joinSession({ sessionId, role: 'node' });
      this.peer.onicecandidate = (event) => {
        if (event.candidate) {
          this.signaling.sendIceCandidate({
            sessionId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      this.stream.getTracks().forEach((track) => this.peer?.addTrack(track, this.stream!));

      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      this.signaling.sendOffer({
        sessionId,
        sdp: { type: offer.type, sdp: offer.sdp ?? undefined },
      });
      this.signaling.clearPendingRequest(sessionId);
    } catch (err) {
      console.warn('camera remote start failed', err);
      this.status.set('error');
      await this.stop();
    }
  }

  private async stop(notifyEnd = true): Promise<void> {
    const currentSessionId = this.activeSessionId();
    if (notifyEnd && currentSessionId) {
      this.signaling.endSession(currentSessionId, 0);
    }

    this.peer?.close();
    this.peer = undefined;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.active.set(false);
    this.status.set('idle');
    this.activeSessionId.set(null);
  }

  ngOnDestroy(): void {
    void this.stop();
  }
}
