import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { HudPanelComponent, CmdButtonComponent } from '@servidor/ui-components';
import { ContentService } from '../../core/content/content.service';
import { ServerConfigService } from '../../core/config/server-config.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';
import { AuthService } from '../../core/auth/auth.service';
import { WebrtcSignalingService } from '../../core/webrtc/webrtc-signaling.service';

interface CameraSessionResponse {
  session: {
    id: string;
    edgeNodeId: string;
    startedAt: string;
    facing: 'front' | 'back';
    status: string;
    encrypted: boolean;
  };
  turn: {
    urls: string[];
    username: string;
    credential: string;
    ttlSeconds: number;
  };
}

@Component({
  selector: 'app-camera',
  standalone: true,
  imports: [CommonModule, HudPanelComponent, CmdButtonComponent, JsonPipe],
  template: `
    <hud-panel [title]="content.t('camera', 'title', 'Cámara remota')">
      <div class="viewer">
        <video #remoteVideo autoplay playsinline class="viewer__video" [class.viewer__video--visible]="state() === 'live'"></video>
        @if (session()) {
          <div class="viewer__session">
            <strong>sesión {{ session()!.session.id }}</strong>
            <span>estado {{ state() }}</span>
            <span>facing {{ session()!.session.facing }}</span>
            <span>turn {{ session()!.turn.urls[0] ?? '—' }}</span>
          </div>
        } @else {
          <div class="viewer__placeholder">
            <span class="viewer__icon">📷</span>
            <span>{{ content.t('camera', 'live', 'Transmisión en vivo desde el edge node') }}</span>
            <span class="viewer__hint">{{ content.t('camera', 'hint', 'La web ya crea la sesión en la API. Falta completar el viewer WebRTC final.') }}</span>
          </div>
        }
      </div>
      <div class="actions">
        <cmd-button primary (cmdClick)="openCamera()">Iniciar cámara</cmd-button>
      </div>
      @if (session()) {
        <pre class="debug">{{ session() | json }}</pre>
      }
    </hud-panel>
  `,
  styles: [`
    .viewer {
      position: relative;
      aspect-ratio: 16 / 9;
      background: #05070a;
      border: 1px solid #1c2530;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      padding: 16px;
    }
    .viewer__video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 160ms ease;
      background: #000;
    }
    .viewer__video--visible {
      opacity: 1;
    }
    .viewer__placeholder,
    .viewer__session {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: #5c6773;
      font-family: 'JetBrains Mono', monospace;
      text-align: center;
    }
    .viewer__session { color: #d7dee3; }
    .viewer__icon { font-size: 32px; }
    .viewer__hint { font-size: 11px; color: #3a4350; }
    .actions { display: flex; gap: 8px; }
    .debug {
      margin-top: 16px;
      background: #05070a;
      border: 1px solid #1c2530;
      padding: 12px;
      color: #5c6773;
      font-size: 11px;
      overflow: auto;
    }
  `],
})
export class CameraComponent implements OnDestroy {
  @ViewChild('remoteVideo') remoteVideo?: ElementRef<HTMLVideoElement>;
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly pairing = inject(PairingStoreService);
  private readonly auth = inject(AuthService);
  private readonly signaling = inject(WebrtcSignalingService);
  readonly content = inject(ContentService);

  readonly session = signal<CameraSessionResponse | null>(null);
  readonly state = signal<'idle' | 'waiting-offer' | 'connecting' | 'live' | 'ended' | 'error'>('idle');
  private peer?: RTCPeerConnection;
  private startedAt = 0;

  constructor() {
    this.signaling.offer$.subscribe((payload) => {
      if (payload.sessionId !== this.session()?.session.id || !this.peer) {
        return;
      }
      void this.acceptOffer(payload);
    });

    this.signaling.iceCandidate$.subscribe((payload) => {
      if (payload.sessionId !== this.session()?.session.id || !this.peer) {
        return;
      }
      void this.peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
    });

    this.signaling.sessionEnded$.subscribe((payload) => {
      if (payload.sessionId === this.session()?.session.id) {
        this.state.set('ended');
        this.destroyPeer();
      }
    });
  }

  openCamera(): void {
    const base = this.server.apiBaseUrl();
    const edgeNodeId = this.pairing.deviceId();
    if (!base || !edgeNodeId) return;
    this.http
      .post<CameraSessionResponse>(`${base}/camera/session`, {
        edgeNodeId,
        quality: 'medium',
        facing: 'back',
      })
      .subscribe({
        next: (session) => {
          this.session.set(session);
          this.state.set('waiting-offer');
          this.startedAt = Date.now();
          this.setupPeer(session, edgeNodeId);
        },
        error: () => {
          this.session.set(null);
          this.state.set('error');
        },
      });
  }

  private setupPeer(session: CameraSessionResponse, edgeNodeId: string): void {
    this.destroyPeer();
    this.signaling.connect(edgeNodeId);
    this.signaling.joinSession({ sessionId: session.session.id, role: 'user' });

    this.peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: session.turn.urls,
          username: session.turn.username,
          credential: session.turn.credential,
        },
      ],
    });
    this.peer.addTransceiver('video', { direction: 'recvonly' });
    this.peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream && this.remoteVideo) {
        this.remoteVideo.nativeElement.srcObject = stream;
        this.state.set('live');
      }
    };
    this.peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate({
          sessionId: session.session.id,
          candidate: event.candidate.toJSON(),
        });
      }
    };
  }

  private async acceptOffer(payload: { sessionId: string; sdp: { type: string; sdp?: string } }): Promise<void> {
    const current = this.session();
    if (!current || !this.peer) {
      return;
    }

    this.state.set('connecting');
    await this.peer.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    this.signaling.sendAnswer({
      sessionId: current.session.id,
      sdp: { type: answer.type, sdp: answer.sdp ?? undefined },
      userId: this.auth.user()?.id ?? 'viewer',
      nodeId: current.session.edgeNodeId,
      mode: 'camera',
    });
  }

  private destroyPeer(): void {
    this.peer?.close();
    this.peer = undefined;
  }

  ngOnDestroy(): void {
    const current = this.session();
    if (current) {
      this.signaling.endSession(current.session.id, Math.max(0, Math.round((Date.now() - this.startedAt) / 1000)));
    }
    this.destroyPeer();
  }
}
