import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
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
  imports: [CommonModule, SlicePipe, HudPanelComponent, CmdButtonComponent],
  template: `
    <hud-panel [title]="content.t('camera', 'title', 'Cámara remota')">
      <div class="viewer">
        <video #remoteVideo autoplay playsinline class="viewer__video" [class.viewer__video--visible]="state() === 'live'"></video>

        @if (state() !== 'live') {
          <div class="viewer__placeholder">
            <span class="viewer__icon">📷</span>
            <span class="viewer__title">{{ placeholderTitle() }}</span>
            <span class="viewer__hint">{{ placeholderHint() }}</span>
            @if (state() === 'waiting-offer' || state() === 'connecting') {
              <span class="viewer__spinner"></span>
            }
            @if (state() === 'error') {
              <span class="viewer__error">{{ errorMessage() ?? 'no se pudo iniciar la cámara' }}</span>
            }
          </div>
        }

        @if (session()) {
          <div class="viewer__statusbar">
            <span class="viewer__pill viewer__pill--{{ state() }}">
              <span class="viewer__dot"></span>
              {{ state() }}
            </span>
            <span class="viewer__meta">sesión {{ session()!.session.id | slice:0:8 }}</span>
            <span class="viewer__meta">facing {{ session()!.session.facing }}</span>
            @if (state() === 'live' && remoteSpeaking()) {
              <span class="viewer__pill viewer__pill--ptt">nodo hablando</span>
            }
          </div>
        }
      </div>

      <audio #remoteAudio autoplay class="viewer__audio"></audio>

      <div class="vu">
        <div class="vu__label">mic</div>
        <div class="vu__bar">
          <div class="vu__fill" [style.width.%]="inputLevel()"></div>
        </div>
      </div>

      <div class="actions">
        @if (state() === 'idle' || state() === 'error' || state() === 'ended') {
          <cmd-button primary (cmdClick)="openCamera()">Iniciar cámara</cmd-button>
        } @else {
          <button
            class="actions__ptt"
            type="button"
            [class.actions__ptt--active]="ptt()"
            (mousedown)="startTalking()"
            (mouseup)="stopTalking()"
            (mouseleave)="stopTalking()"
            (touchstart)="startTalking()"
            (touchend)="stopTalking()"
            [disabled]="state() !== 'live'"
          >
            {{ ptt() ? 'hablando…' : 'mantener para hablar' }}
          </button>
          <cmd-button (cmdClick)="stop()">Detener</cmd-button>
        }
      </div>
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
      margin-bottom: 12px;
      padding: 0;
      overflow: hidden;
    }
    .viewer__video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 240ms ease;
      background: #000;
    }
    .viewer__video--visible { opacity: 1; }
    .viewer__audio { display: none; }
    .viewer__placeholder {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      color: #5c6773;
      font-family: 'JetBrains Mono', monospace;
      text-align: center;
      padding: 24px;
    }
    .viewer__icon { font-size: 36px; }
    .viewer__title { color: #d7dee3; font-size: 14px; }
    .viewer__hint { font-size: 11px; color: #3a4350; max-width: 280px; }
    .viewer__error { font-size: 12px; color: #ff6b35; }
    .viewer__spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #1c2530;
      border-top-color: #ff7a1a;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
      margin-top: 6px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .viewer__statusbar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: linear-gradient(to bottom, rgba(5,7,10,0.85) 0%, rgba(5,7,10,0) 100%);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #5c6773;
      z-index: 2;
      pointer-events: none;
    }
    .viewer__pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px;
      border-radius: 2px;
      border: 1px solid #1c2530;
      background: rgba(5,7,10,0.7);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 10px;
    }
    .viewer__pill--live { color: #5ce17a; border-color: #1f4a2c; }
    .viewer__pill--waiting-offer,
    .viewer__pill--connecting { color: #ff7a1a; border-color: #4a2e1c; }
    .viewer__pill--ended,
    .viewer__pill--idle { color: #5c6773; }
    .viewer__pill--error { color: #ff6b35; border-color: #4a1f1c; }
    .viewer__pill--ptt { color: #39ff88; border-color: #1f4a2c; }
    .viewer__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .viewer__pill--live .viewer__dot { animation: pulse 1.6s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.3; } }

    .vu {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #5c6773;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .vu__bar {
      flex: 1;
      height: 4px;
      background: #0a1218;
      border: 1px solid #1c2530;
      overflow: hidden;
    }
    .vu__fill {
      height: 100%;
      background: linear-gradient(to right, #5ce17a, #ff7a1a);
      transition: width 80ms linear;
      width: 0;
    }

    .actions { display: flex; gap: 8px; }
    .actions__ptt {
      flex: 1;
      background: #1c2530;
      color: #d7dee3;
      border: 1px solid #ff7a1a;
      padding: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
    }
    .actions__ptt:hover:not(:disabled) { background: #2a3540; }
    .actions__ptt:disabled { opacity: 0.4; cursor: not-allowed; }
    .actions__ptt--active {
      background: #ff7a1a;
      color: #05070a;
    }
  `],
})
export class CameraComponent implements OnDestroy {
  @ViewChild('remoteVideo') remoteVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteAudio') remoteAudio?: ElementRef<HTMLAudioElement>;
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly pairing = inject(PairingStoreService);
  private readonly auth = inject(AuthService);
  private readonly signaling = inject(WebrtcSignalingService);
  readonly content = inject(ContentService);

  readonly session = signal<CameraSessionResponse | null>(null);
  readonly state = signal<'idle' | 'waiting-offer' | 'connecting' | 'live' | 'ended' | 'error'>('idle');
  readonly errorMessage = signal<string | null>(null);
  readonly ptt = signal(false);
  readonly remoteSpeaking = signal(false);
  readonly inputLevel = signal(0);

  private peer?: RTCPeerConnection;
  private startedAt = 0;
  private micStream?: MediaStream;
  private micSender?: RTCRtpSender;
  private audioAnalyser?: AnalyserNode;
  private audioCtx?: AudioContext;
  private vuTimer?: number;

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
        this.cleanup();
      }
    });
  }

  placeholderTitle(): string {
    switch (this.state()) {
      case 'waiting-offer': return 'Esperando señal del nodo…';
      case 'connecting': return 'Conectando…';
      case 'error': return 'Error de conexión';
      case 'ended': return 'Sesión finalizada';
      default: return 'Cámara apagada';
    }
  }

  placeholderHint(): string {
    if (this.state() === 'idle') {
      return 'Pulsa "Iniciar cámara" para abrir la cámara frontal del edge node';
    }
    if (this.state() === 'waiting-offer') {
      return 'La cámara del celular se está activando automáticamente';
    }
    if (this.state() === 'connecting') {
      return 'Intercambiando credenciales WebRTC…';
    }
    return '';
  }

  openCamera(): void {
    const base = this.server.apiBaseUrl();
    const edgeNodeId = this.pairing.deviceId();
    if (!base || !edgeNodeId) {
      this.errorMessage.set('Falta emparejar el nodo o la URL de la API');
      this.state.set('error');
      return;
    }
    this.errorMessage.set(null);
    this.state.set('waiting-offer');
    this.http
      .post<CameraSessionResponse>(`${base}/camera/session`, {
        edgeNodeId,
        quality: 'medium',
        facing: 'front',
      })
      .subscribe({
        next: (session) => {
          this.session.set(session);
          this.startedAt = Date.now();
          this.setupPeer(session, edgeNodeId);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? err?.message ?? 'error de la API');
          this.state.set('error');
          this.session.set(null);
        },
      });
  }

  stop(): void {
    const current = this.session();
    if (current) {
      const duration = Math.max(0, Math.round((Date.now() - this.startedAt) / 1000));
      this.signaling.endSession(current.session.id, duration);
    }
    this.state.set('ended');
    this.cleanup();
  }

  async startTalking(): Promise<void> {
    if (this.ptt() || this.state() !== 'live') {
      return;
    }
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      const track = this.micStream.getAudioTracks()[0];
      if (!track || !this.peer) {
        return;
      }
      const senders = this.peer.getSenders();
      const existingAudio = senders.find((s) => s.track?.kind === 'audio');
      if (existingAudio) {
        await existingAudio.replaceTrack(track);
        this.micSender = existingAudio;
      } else {
        this.micSender = this.peer.addTrack(track, this.micStream);
      }
      this.attachMicAnalyser(this.micStream);
      this.ptt.set(true);
    } catch (err) {
      console.warn('mic permission denied', err);
      this.errorMessage.set('Permiso de micrófono denegado');
    }
  }

  stopTalking(): void {
    if (!this.ptt()) {
      return;
    }
    this.ptt.set(false);
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = undefined;
    if (this.micSender) {
      this.micSender.replaceTrack(null).catch(() => undefined);
    }
    if (this.vuTimer) {
      cancelAnimationFrame(this.vuTimer);
      this.vuTimer = undefined;
    }
    this.inputLevel.set(0);
  }

  private attachMicAnalyser(stream: MediaStream): void {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) {
        return;
      }
      if (!this.audioCtx) {
        this.audioCtx = new Ctx();
      }
      const ctx: AudioContext = this.audioCtx!;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      this.audioAnalyser = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!this.audioAnalyser) {
          return;
        }
        this.audioAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        this.inputLevel.set(Math.min(100, (avg / 128) * 100));
        this.vuTimer = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      console.warn('cannot attach mic analyser', err);
    }
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
    this.peer.addTransceiver('audio', { direction: 'recvonly' });
    this.peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) {
        return;
      }
      if (event.track.kind === 'video' && this.remoteVideo) {
        this.remoteVideo.nativeElement.srcObject = stream;
        this.state.set('live');
      }
      if (event.track.kind === 'audio' && this.remoteAudio) {
        this.remoteAudio.nativeElement.srcObject = stream;
        this.attachRemoteAudioAnalyser(stream);
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
    this.peer.oniceconnectionstatechange = () => {
      if (this.peer?.iceConnectionState === 'failed' || this.peer?.iceConnectionState === 'disconnected') {
        this.errorMessage.set('Conexión ICE caída');
        this.state.set('error');
        this.cleanup();
      }
    };
  }

  private attachRemoteAudioAnalyser(stream: MediaStream): void {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) {
        return;
      }
      if (!this.audioCtx) {
        this.audioCtx = new Ctx();
      }
      const ctx: AudioContext = this.audioCtx!;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        const isSpeaking = avg > 6;
        if (isSpeaking !== this.remoteSpeaking()) {
          this.remoteSpeaking.set(isSpeaking);
        }
        this.vuTimer = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      console.warn('cannot attach remote audio analyser', err);
    }
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

  private cleanup(): void {
    this.stopTalking();
    this.destroyPeer();
    if (this.vuTimer) {
      cancelAnimationFrame(this.vuTimer);
      this.vuTimer = undefined;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close();
    }
    this.audioCtx = undefined;
    this.audioAnalyser = undefined;
    this.remoteSpeaking.set(false);
    this.inputLevel.set(0);
    setTimeout(() => {
      if (this.state() === 'ended' || this.state() === 'error') {
        this.session.set(null);
      }
    }, 1500);
  }

  private destroyPeer(): void {
    this.peer?.close();
    this.peer = undefined;
    if (this.remoteVideo) {
      this.remoteVideo.nativeElement.srcObject = null;
    }
    if (this.remoteAudio) {
      this.remoteAudio.nativeElement.srcObject = null;
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
