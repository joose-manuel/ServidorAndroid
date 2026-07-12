import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Subscription, filter, take, timeout } from 'rxjs';
import { WebrtcSignalingService } from '../../core/webrtc/webrtc-signaling.service';
import { DeviceRuntime } from '../../core/device/device-runtime.plugin';

@Component({
  selector: 'app-intercom',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ic">
      <h2 class="ic__title">&gt; intercom</h2>

      <audio #remoteAudio autoplay class="ic__audio"></audio>

      <div class="ic__meta">
        <span>estado {{ status() }}</span>
        <span>sesión {{ activeSessionId() ?? 'sin sesión remota' }}</span>
        <span>solicitud {{ pendingSessionId() ?? 'sin solicitud pendiente' }}</span>
        <span>signaling-pending {{ signalingPendingId() ?? '—' }}</span>
        <span>viewReady {{ viewReadyForTemplate() ? 'sí' : 'no' }}</span>
      </div>

      <div class="ic__vu">
        <div class="ic__vu-bar" [style.width.%]="outputLevel()"></div>
      </div>

      <button
        class="ic__ptt"
        type="button"
        [class.ic__ptt--active]="ptt()"
        (mousedown)="startTalking()"
        (mouseup)="stopTalking()"
        (mouseleave)="stopTalking()"
        (touchstart)="startTalking()"
        (touchend)="stopTalking()"
        [disabled]="state() !== 'live'"
      >
        {{ ptt() ? 'hablando…' : 'mantener presionado para hablar' }}
      </button>

      <div class="ic__bar">
        <button class="ic__btn" type="button" (click)="forceStartFromSignaling()">
          iniciar intercom remoto
        </button>
        @if (pendingSessionId() && !activeSessionId()) {
          <button class="ic__btn ic__btn--ghost" type="button" (click)="acceptPendingRequest()">
            aceptar pendiente
          </button>
          <button class="ic__btn ic__btn--ghost" type="button" (click)="dismissPendingRequest()">
            descartar solicitud
          </button>
        }
      </div>

      <label class="ic__mute">
        <input
          type="checkbox"
          [checked]="remoteMuted()"
          (change)="toggleRemoteMute()"
        />
        silenciar salida hacia la web
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
      .ic__audio {
        display: none;
      }
      .ic__meta {
        display: grid;
        gap: 4px;
        font-size: 11px;
        color: #5c6773;
        margin: 12px 0;
      }
      .ic__vu {
        width: 100%;
        height: 4px;
        background: #0a1218;
        border: 1px solid #1c2530;
        overflow: hidden;
        margin-bottom: 12px;
      }
      .ic__vu-bar {
        height: 100%;
        background: linear-gradient(to right, #5ce17a, #ff7a1a);
        transition: width 80ms linear;
        width: 0;
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
        cursor: pointer;
      }
      .ic__ptt--active {
        background: #ff7a1a;
        color: #05070a;
      }
      .ic__ptt:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .ic__bar {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
      }
      .ic__btn {
        background: #ff7a1a;
        color: #05070a;
        border: none;
        padding: 14px;
        font-family: inherit;
        font-weight: 700;
        text-transform: uppercase;
      }
      .ic__btn--ghost {
        background: #0a0e14;
        color: #d7dee3;
        border: 1px solid #1c2530;
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
export class IntercomComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('remoteAudio') remoteAudioRef!: ElementRef<HTMLAudioElement>;
  private readonly signaling = inject(WebrtcSignalingService);

  readonly status = signal<'idle' | 'awaiting-answer' | 'live' | 'error'>('idle');
  readonly state = signal<'idle' | 'connecting' | 'live' | 'error'>('idle');
  readonly activeSessionId = signal<string | null>(null);
  readonly pendingSessionId = signal<string | null>(null);
  readonly signalingPendingId = signal<string | null>(null);
  readonly viewReadyForTemplate = signal(false);
  readonly ptt = signal(false);
  readonly remoteMuted = signal(false);
  readonly outputLevel = signal(0);

  private stream?: MediaStream;
  private peer?: RTCPeerConnection;
  private readonly viewReady = signal(false);
  private pendingSub?: Subscription;
  private vuTimer?: number;
  private audioCtx?: AudioContext;
  private audioAnalyser?: AnalyserNode;

  constructor() {
    // Bridge de solo-lectura hacia la UI para diagnóstico.
    effect(() => {
      this.signalingPendingId.set(this.signaling.pendingRequest()?.sessionId ?? null);
    });
  }

  ngOnInit(): void {
    this.signaling.answer$.subscribe((payload) => {
      if (payload.sessionId !== this.activeSessionId() || !this.peer) {
        return;
      }
      void this.peer.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit).then(() => {
        this.status.set('live');
        this.state.set('live');
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
        void this.stop();
      }
      if (payload.sessionId === this.pendingSessionId()) {
        this.pendingSessionId.set(null);
      }
    });

    this.pendingSub = this.signaling.sessionRequested$.subscribe((request) => {
      console.log('[intercom] sessionRequested$ fired', request.sessionId, 'viewReady=', this.viewReady());
      this.tryAutoStart();
    });
  }

  private async acquireMicStream(): Promise<MediaStream> {
    // Constraints simples (sin echoCancellation/noiseSuppression) para
    // evitar que el WebView Android descarte el audio silenciosamente.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      console.log('[intercom] mic acquired, audioTracks=', stream.getAudioTracks().length);
      return stream;
    } catch (err) {
      console.warn('[intercom] mic acquire failed', err);
      throw err;
    }
  }

  private tryAutoStart(): void {
    const request = this.signaling.pendingRequest();
    if (!request || request.mode !== 'intercom' || !this.viewReady()) {
      return;
    }
    this.pendingSessionId.set(request.sessionId);
    if (this.activeSessionId() === request.sessionId) {
      return;
    }
    this.startRemoteSession(request.sessionId, request.turn?.urls ? request.turn : undefined).catch(
      (err) => {
        console.error('[intercom] autoStart failed', err);
      },
    );
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
    this.viewReadyForTemplate.set(true);
    console.log('[intercom] ngAfterViewInit viewReady=true');
    this.tryAutoStart();
  }

  ngOnDestroy(): void {
    this.pendingSub?.unsubscribe();
    void this.stop();
    this.detachVuMeter();
  }

  async acceptPendingRequest(): Promise<void> {
    const request = this.signaling.pendingRequest();
    if (!request || request.mode !== 'intercom') {
      return;
    }
    await this.startRemoteSession(request.sessionId, request.turn?.urls ? request.turn : undefined);
  }

  async forceStartFromSignaling(): Promise<void> {
    const request = this.signaling.pendingRequest();
    if (!request) {
      return;
    }
    if (request.mode !== 'intercom') {
      return;
    }
    if (!this.viewReady()) {
      console.warn('[intercom] forceStartFromSignaling: view not ready yet');
      return;
    }
    this.pendingSessionId.set(request.sessionId);
    if (this.activeSessionId() === request.sessionId) {
      return;
    }
    try {
      await this.startRemoteSession(request.sessionId, request.turn?.urls ? request.turn : undefined);
    } catch (err) {
      console.error('[intercom] forceStartFromSignaling failed', err);
    }
  }

  dismissPendingRequest(): void {
    this.signaling.clearPendingRequest();
    this.pendingSessionId.set(null);
    this.status.set('idle');
    this.state.set('idle');
  }

  private async startRemoteSession(
    sessionId: string,
    turn?: { urls: string[]; username: string; credential: string; ttlSeconds: number },
  ): Promise<void> {
    console.log('[intercom] startRemoteSession called', sessionId, { hasTurn: !!turn });
    fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"intercom-debug",runId:"post-fix",hypothesisId:"I",location:"edge/intercom.component.ts:startRemoteSession:entry",msg:"[DEBUG] intercom start",data:{sessionId,hasTurn:!!turn,nativePlatform:Capacitor.isNativePlatform()},ts:Date.now()})}).catch(()=>{});
    this.status.set('awaiting-answer');
    this.state.set('connecting');

    try {
      await this.stop(false);

      if (Capacitor.isNativePlatform()) {
        const permissionResult = await DeviceRuntime.ensureMicrophonePermission();
        console.log('[intercom] mic permission result', permissionResult);
        // No bloqueamos: si no hay mic, el intercom sigue funcionando para
        // escuchar a la web; el PTT simplemente no tendrá stream local.
      }

      this.stream = await this.acquireMicStream();
      console.log('[intercom] getUserMedia ok', this.stream.getAudioTracks().length, 'audio tracks');
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"intercom-debug",runId:"post-fix",hypothesisId:"I",location:"edge/intercom.component.ts:getUserMedia:ok",msg:"[DEBUG] intercom mic acquired",data:{sessionId,audioTracks:this.stream.getAudioTracks().length},ts:Date.now()})}).catch(()=>{});
      this.attachOutputAnalyser();
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

      // Transceiver recvonly para que la web pueda mandarnos PTT (audio) incluso
      // si el getUserMedia local no devolvió tracks.
      this.peer.addTransceiver('audio', { direction: 'recvonly' });

      this.signaling.joinSession({ sessionId, role: 'node' });

      // Espera a que la web se una a la sala antes de enviar la oferta.
      // Sin esto, hay race condition y la web queda en waiting-offer.
      console.log('[intercom] waiting for web peer-joined', sessionId);
      await this.signaling
        .peerJoined$
        .pipe(
          filter((p) => p.sessionId === sessionId && p.role === 'user'),
          take(1),
          timeout({ first: 2000, meta: { sessionId } }),
        )
        .toPromise()
        .catch(() => undefined);
      console.log('[intercom] web is in the room, sending offer');

      this.peer.onicecandidate = (event) => {
        if (event.candidate) {
          this.signaling.sendIceCandidate({
            sessionId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      this.peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream && this.remoteAudioRef) {
          this.remoteAudioRef.nativeElement.srcObject = stream;
          this.status.set('live');
          this.state.set('live');
        }
      };

      this.stream!.getAudioTracks().forEach((track) => this.peer?.addTrack(track, this.stream!));

      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      console.log('[intercom] offer created', offer.type, !!offer.sdp);
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"intercom-debug",runId:"post-fix",hypothesisId:"I",location:"edge/intercom.component.ts:offer-created",msg:"[DEBUG] intercom offer created",data:{sessionId,offerType:offer.type,hasSdp:!!offer.sdp},ts:Date.now()})}).catch(()=>{});
      this.signaling.sendOffer({
        sessionId,
        sdp: { type: offer.type, sdp: offer.sdp ?? undefined },
      });
      this.signaling.clearPendingRequest(sessionId);
      this.pendingSessionId.set(sessionId);
    } catch (err) {
      console.error('[intercom] remote session failed', err);
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"intercom-debug",runId:"post-fix",hypothesisId:"I",location:"edge/intercom.component.ts:catch",msg:"[DEBUG] intercom remote session failed",data:{sessionId,errorName:err instanceof Error ? err.name : typeof err,errorMessage:err instanceof Error ? err.message : String(err)},ts:Date.now()})}).catch(()=>{});
      this.status.set('error');
      this.state.set('error');
      await this.stop();
    }
  }

  async startTalking(): Promise<void> {
    if (this.ptt() || !this.peer) {
      return;
    }
    const senders = this.peer.getSenders();
    const audioSender = senders.find((s) => s.track?.kind === 'audio');
    if (!audioSender) {
      return;
    }
    if (!this.stream) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.attachOutputAnalyser();
      } catch (err) {
        console.warn('mic permission denied', err);
        return;
      }
    }
    const track = this.stream.getAudioTracks()[0];
    if (!track) {
      return;
    }
    track.enabled = true;
    await audioSender.replaceTrack(track);
    this.ptt.set(true);
  }

  stopTalking(): void {
    if (!this.ptt() || !this.peer) {
      return;
    }
    const senders = this.peer.getSenders();
    const audioSender = senders.find((s) => s.track?.kind === 'audio');
    if (audioSender) {
      audioSender.replaceTrack(null).catch(() => undefined);
    }
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = false));
    this.ptt.set(false);
  }

  async toggleRemoteMute(): Promise<void> {
    const next = !this.remoteMuted();
    this.remoteMuted.set(next);
    if (this.peer) {
      const senders = this.peer.getSenders();
      const audioSender = senders.find((s) => s.track?.kind === 'audio');
      if (audioSender) {
        if (next) {
          await audioSender.replaceTrack(null).catch(() => undefined);
        } else if (this.stream) {
          const track = this.stream.getAudioTracks()[0];
          if (track) {
            track.enabled = true;
            await audioSender.replaceTrack(track).catch(() => undefined);
          }
        }
      }
    }
  }

  private attachOutputAnalyser(): void {
    if (!this.stream) {
      return;
    }
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) {
        return;
      }
      if (!this.audioCtx) {
        this.audioCtx = new Ctx();
      }
      const ctx: AudioContext = this.audioCtx!;
      const source = ctx.createMediaStreamSource(this.stream);
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
        this.outputLevel.set(Math.min(100, (avg / 128) * 100));
        this.vuTimer = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      console.warn('[intercom] cannot attach VU meter', err);
    }
  }

  private detachVuMeter(): void {
    if (this.vuTimer) {
      cancelAnimationFrame(this.vuTimer);
      this.vuTimer = undefined;
    }
    this.audioAnalyser = undefined;
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close();
    }
    this.audioCtx = undefined;
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
    this.status.set('idle');
    this.state.set('idle');
    this.activeSessionId.set(null);
    if (notifyEnd) {
      this.pendingSessionId.set(null);
    }
    if (this.remoteAudioRef) {
      this.remoteAudioRef.nativeElement.srcObject = null;
    }
  }
}
