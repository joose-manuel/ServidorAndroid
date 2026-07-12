import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ContentService } from '../../core/content/content.service';
import { PairingStoreService } from '../../core/pairing/pairing-store.service';
import { ServerConfigService } from '../../core/config/server-config.service';
import { WebrtcSignalingService } from '../../core/webrtc/webrtc-signaling.service';
import { HudPanelComponent, CmdButtonComponent } from '@servidor/ui-components';

interface IntercomSessionResponse {
  session: {
    id: string;
    edgeNodeId: string;
    startedAt: string;
    status: string;
    remoteMuted: boolean;
    localMuted: boolean;
  };
  turn: { urls: string[]; username: string; credential: string; ttlSeconds: number };
}

@Component({
  selector: 'app-intercom',
  standalone: true,
  imports: [CommonModule, HudPanelComponent, CmdButtonComponent],
  template: `
    <hud-panel [title]="content.t('intercom', 'title', 'Interfono bidireccional')">
      <div class="ic">
        <div class="ic__visual" [class.ic__visual--live]="state() === 'live'">
          <div class="ic__orb">
            <span class="ic__pulse"></span>
            <span class="ic__pulse ic__pulse--2"></span>
            <span class="ic__pulse ic__pulse--3"></span>
            <span class="ic__icon">🎙</span>
          </div>
          <div class="ic__label">
            @switch (state()) {
              @case ('live') { transmisión de audio en vivo }
              @case ('waiting-offer') { esperando señal del nodo… }
              @case ('connecting') { conectando audio… }
              @case ('ended') { sesión finalizada }
              @case ('error') { error: {{ errorMessage() ?? 'desconocido' }} }
              @default { interfono apagado }
            }
          </div>
        </div>

        <audio #remoteAudio autoplay class="ic__audio"></audio>

        @if (session()) {
          <div class="ic__statusbar">
            <span class="ic__pill ic__pill--{{ state() }}">
              <span class="ic__dot"></span>
              {{ state() }}
            </span>
            <span class="ic__meta">sesión {{ session()!.session.id | slice: 0 : 8 }}</span>
            @if (state() === 'live' && speakingNow()) {
              <span class="ic__pill ic__pill--ptt">nodo hablando</span>
            }
          </div>
        }

        <div class="ic__vu">
          <div class="ic__vu-bar" [style.width.%]="inputLevel()"></div>
        </div>

        <div class="ic__actions">
          @if (state() === 'idle' || state() === 'ended' || state() === 'error') {
            <cmd-button primary (cmdClick)="openIntercom()">Iniciar intercom</cmd-button>
          } @else {
            <button
              class="ic__ptt"
              type="button"
              [class.ic__ptt--active]="ptt()"
              (mousedown)="startTalking()"
              (mouseup)="stopTalking()"
              (mouseleave)="stopTalking()"
              (touchstart)="startTalking()"
              (touchend)="stopTalking()"
              [disabled]="state() !== 'live' && state() !== 'connecting'"
            >
              {{ ptt() ? 'hablando…' : 'mantener para hablar' }}
            </button>
            <cmd-button (cmdClick)="stop()">Detener</cmd-button>
          }
        </div>
      </div>
    </hud-panel>
  `,
  styles: [`
    .ic {
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-family: 'JetBrains Mono', monospace;
    }
    .ic__audio { display: none; }
    .ic__visual {
      position: relative;
      aspect-ratio: 16 / 9;
      background: #05070a;
      border: 1px solid #1c2530;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      transition: border-color 200ms ease;
    }
    .ic__visual--live { border-color: #1f4a2c; }

    .ic__orb {
      position: relative;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: #0a1218;
      border: 1px solid #1c2530;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
    }
    .ic__visual--live .ic__orb { border-color: #ff7a1a; }

    .ic__pulse {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 1px solid #ff7a1a;
      opacity: 0;
    }
    .ic__visual--live .ic__pulse {
      animation: ripple 2.2s ease-out infinite;
    }
    .ic__visual--live .ic__pulse--2 { animation-delay: 0.7s; }
    .ic__visual--live .ic__pulse--3 { animation-delay: 1.4s; }
    @keyframes ripple {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(2.4); opacity: 0; }
    }

    .ic__label {
      color: #5c6773;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .ic__statusbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      font-size: 11px;
      color: #5c6773;
    }
    .ic__pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px;
      border-radius: 2px;
      border: 1px solid #1c2530;
      background: #05070a;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 10px;
    }
    .ic__pill--live { color: #5ce17a; border-color: #1f4a2c; }
    .ic__pill--waiting-offer,
    .ic__pill--connecting { color: #ff7a1a; border-color: #4a2e1c; }
    .ic__pill--ended,
    .ic__pill--idle { color: #5c6773; }
    .ic__pill--error { color: #ff6b35; border-color: #4a1f1c; }
    .ic__pill--ptt { color: #39ff88; border-color: #1f4a2c; }
    .ic__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .ic__pill--live .ic__dot { animation: pulse 1.6s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.3; } }

    .ic__vu {
      width: 100%;
      height: 4px;
      background: #0a1218;
      border: 1px solid #1c2530;
      overflow: hidden;
    }
    .ic__vu-bar {
      height: 100%;
      background: linear-gradient(to right, #5ce17a, #ff7a1a);
      transition: width 80ms linear;
      width: 0;
    }

    .ic__actions {
      display: flex;
      gap: 8px;
      align-items: stretch;
    }
    .ic__ptt {
      flex: 1;
      background: #1c2530;
      color: #d7dee3;
      border: 1px solid #ff7a1a;
      padding: 16px;
      font-family: inherit;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
    }
    .ic__ptt:hover:not(:disabled) { background: #2a3540; }
    .ic__ptt:disabled { opacity: 0.4; cursor: not-allowed; }
    .ic__ptt--active {
      background: #ff7a1a;
      color: #05070a;
    }
  `],
})
export class IntercomComponent implements OnDestroy {
  @ViewChild('remoteAudio') remoteAudio?: ElementRef<HTMLAudioElement>;
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly pairing = inject(PairingStoreService);
  private readonly auth = inject(AuthService);
  private readonly signaling = inject(WebrtcSignalingService);
  readonly content = inject(ContentService);

  readonly session = signal<IntercomSessionResponse | null>(null);
  readonly state = signal<'idle' | 'waiting-offer' | 'connecting' | 'live' | 'ended' | 'error'>('idle');
  readonly errorMessage = signal<string | null>(null);
  readonly ptt = signal(false);
  readonly speakingNow = signal(false);
  readonly inputLevel = signal(0);

  private peer?: RTCPeerConnection;
  private startedAt = 0;
  private micStream?: MediaStream;
  private pttSender?: RTCRtpSender;
  private audioAnalyser?: AnalyserNode;
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

  async openIntercom(): Promise<void> {
    const base = this.server.apiBaseUrl();
    const edgeNodeId = this.pairing.deviceId();
    if (!base || !edgeNodeId) {
      this.errorMessage.set('Falta emparejar el nodo o la URL de la API');
      this.state.set('error');
      return;
    }
    this.errorMessage.set(null);
    this.state.set('waiting-offer');
    try {
      const session = await firstValueFrom(
        this.http.post<IntercomSessionResponse>(`${base}/intercom/session`, { edgeNodeId }),
      );
      this.session.set(session);
      this.startedAt = Date.now();
      this.setupPeer(session, edgeNodeId);
    } catch (err: any) {
      this.errorMessage.set(err?.error?.message ?? err?.message ?? 'error de la API');
      this.state.set('error');
      this.session.set(null);
    }
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
    if (this.ptt()) return;
    if (this.state() !== 'live' && this.state() !== 'connecting') return;
    if (!this.peer) return;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      const track = this.micStream.getAudioTracks()[0];
      if (track) {
        // Reemplaza el transceiver de audio sendonly o añade un track nuevo
        const senders = this.peer.getSenders();
        const existingAudio = senders.find((s) => s.track?.kind === 'audio');
        if (existingAudio) {
          await existingAudio.replaceTrack(track);
        } else {
          this.pttSender = this.peer.addTrack(track, this.micStream);
        }
        this.attachMicAnalyser(this.micStream);
        this.ptt.set(true);
        this.speakingNow.set(true);
      }
    } catch (err) {
      console.warn('mic permission denied', err);
      this.errorMessage.set('Permiso de micrófono denegado');
    }
  }

  stopTalking(): void {
    if (!this.ptt()) return;
    this.ptt.set(false);
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = undefined;
    this.speakingNow.set(false);
    // Vuelve a modo mute: deja el transceiver con un track vacío
    if (this.peer) {
      const senders = this.peer.getSenders();
      const audioSender = senders.find((s) => s.track?.kind === 'audio');
      if (audioSender) {
        audioSender.replaceTrack(null).catch(() => undefined);
      }
    }
    if (this.vuTimer) {
      cancelAnimationFrame(this.vuTimer);
      this.vuTimer = undefined;
    }
    this.inputLevel.set(0);
  }

  private attachMicAnalyser(stream: MediaStream): void {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    this.audioAnalyser = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      this.inputLevel.set(Math.min(100, (avg / 128) * 100));
      this.vuTimer = requestAnimationFrame(tick);
    };
    tick();
  }

  private setupPeer(session: IntercomSessionResponse, edgeNodeId: string): void {
    this.destroyPeer();
    this.signaling.connect(edgeNodeId);
    this.signaling.joinSession({ sessionId: session.session.id, role: 'user' });

    this.peer = new RTCPeerConnection({
      iceServers: [
        { urls: session.turn.urls, username: session.turn.username, credential: session.turn.credential },
      ],
    });
    this.peer.addTransceiver('audio', { direction: 'recvonly' });
    this.peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream && this.remoteAudio) {
        this.remoteAudio.nativeElement.srcObject = stream;
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
    this.peer.oniceconnectionstatechange = () => {
      if (this.peer?.iceConnectionState === 'failed' || this.peer?.iceConnectionState === 'disconnected') {
        this.errorMessage.set('Conexión ICE caída');
        this.state.set('error');
        this.cleanup();
      }
    };
  }

  private async acceptOffer(payload: { sessionId: string; sdp: { type: string; sdp?: string } }): Promise<void> {
    const current = this.session();
    if (!current || !this.peer) return;

    this.state.set('connecting');
    await this.peer.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    this.signaling.sendAnswer({
      sessionId: current.session.id,
      sdp: { type: answer.type, sdp: answer.sdp ?? undefined },
      userId: this.auth.user()?.id ?? 'viewer',
      nodeId: current.session.edgeNodeId,
      mode: 'intercom',
    });
  }

  private cleanup(): void {
    this.stopTalking();
    this.destroyPeer();
    if (this.vuTimer) {
      cancelAnimationFrame(this.vuTimer);
      this.vuTimer = undefined;
    }
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
    if (this.remoteAudio) {
      this.remoteAudio.nativeElement.srcObject = null;
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
