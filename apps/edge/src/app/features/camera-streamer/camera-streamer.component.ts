import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Subscription, filter, take, timeout } from 'rxjs';
import { ServerConfigService } from '../../core/config/server-config.service';
import { DeviceIdentityService } from '../../core/device/device-identity.service';
import { DeviceRuntime } from '../../core/device/device-runtime.plugin';
import { WebrtcSignalingService } from '../../core/webrtc/webrtc-signaling.service';

@Component({
  selector: 'app-camera-streamer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cam">
      <h2 class="cam__title">&gt; camera-streamer</h2>
      <video #video autoplay playsinline muted class="cam__video"></video>
      <audio #remoteAudio autoplay class="cam__audio"></audio>
      <div class="cam__vu">
        <span class="cam__vu-label">audio</span>
        <div class="cam__vu-bar">
          <div class="cam__vu-fill" [style.width.%]="outputLevel()"></div>
        </div>
        @if (remoteSpeaking()) {
          <span class="cam__vu-pill">web hablando</span>
        }
      </div>
      <div class="cam__meta">
        <span>estado {{ status() }}</span>
        <span>sesión {{ activeSessionId() ?? 'sin sesión remota' }}</span>
        <span>solicitud {{ pendingSessionId() ?? 'sin solicitud pendiente' }}</span>
        <span>signaling-pending {{ signalingPendingId() ?? '—' }}</span>
        <span>viewReady {{ viewReadyForTemplate() ? 'sí' : 'no' }}</span>
      </div>
      <div class="cam__bar">
        <button class="cam__btn" type="button" (click)="forceStartFromSignaling()">
          iniciar cámara remota
        </button>
        @if (pendingSessionId() && !activeSessionId()) {
          <button class="cam__btn cam__btn--ghost" type="button" (click)="acceptPendingRequest()">
            aceptar pendiente
          </button>
          <button class="cam__btn cam__btn--ghost" type="button" (click)="dismissPendingRequest()">
            descartar solicitud
          </button>
        }
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
      .cam__audio {
        display: none;
      }
      .cam__vu {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
      }
      .cam__vu-label {
        color: #5c6773;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .cam__vu-bar {
        flex: 1;
        height: 4px;
        background: #0a1218;
        border: 1px solid #1c2530;
        overflow: hidden;
      }
      .cam__vu-fill {
        height: 100%;
        background: linear-gradient(to right, #5ce17a, #ff7a1a);
        transition: width 80ms linear;
        width: 0;
      }
      .cam__vu-pill {
        color: #39ff88;
        font-size: 10px;
        text-transform: uppercase;
        border: 1px solid #1f4a2c;
        padding: 2px 6px;
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
      .cam__btn--ghost {
        background: #0a0e14;
        color: #d7dee3;
        border: 1px solid #1c2530;
        margin-top: 8px;
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
  @ViewChild('remoteAudio') remoteAudioRef!: ElementRef<HTMLAudioElement>;
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly deviceIdentity = inject(DeviceIdentityService);
  private readonly signaling = inject(WebrtcSignalingService);
  readonly active = signal(false);
  readonly status = signal<'idle' | 'awaiting-answer' | 'streaming' | 'error'>('idle');
  readonly activeSessionId = signal<string | null>(null);
  readonly pendingSessionId = signal<string | null>(null);
  readonly signalingPendingId = signal<string | null>(null);
  readonly viewReadyForTemplate = signal(false);
  readonly outputLevel = signal(0);
  readonly remoteSpeaking = signal(false);
  private stream?: MediaStream;
  private peer?: RTCPeerConnection;
  private readonly viewReady = signal(false);
  private pendingSub?: Subscription;
  private audioCtx?: AudioContext;
  private audioAnalyser?: AnalyserNode;
  private vuTimer?: number;

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
      if (payload.sessionId === this.pendingSessionId()) {
        this.pendingSessionId.set(null);
      }
    });

    // Auto-trigger robusto basado en Subject del signaling.
    // Es 100% determinista: cuando llega un session-requested nuevo
    // por el WebSocket, el Subject emite y arrancamos la cámara.
    this.pendingSub = this.signaling.sessionRequested$.subscribe((request) => {
      console.log('[camera] sessionRequested$ fired', request.sessionId, 'viewReady=', this.viewReady());
      this.tryAutoStart();
    });
  }

  /**
   * Reintenta el auto-start. Se llama desde la subscripción Y desde
   * ngAfterViewInit, para cubrir tanto el caso "llega la request antes
   * de que la vista esté lista" como "la vista está lista antes de la request".
   */
  private tryAutoStart(): void {
    const request = this.signaling.pendingRequest();
    if (!request || request.mode !== 'camera' || !this.viewReady()) {
      console.log('[camera] tryAutoStart: skipped', {
        hasRequest: !!request,
        mode: request?.mode,
        viewReady: this.viewReady(),
      });
      return;
    }
    this.pendingSessionId.set(request.sessionId);
    if (this.activeSessionId() === request.sessionId) {
      return;
    }
    this.startRemoteSession(request.sessionId, request.turn?.urls ? request.turn : undefined).catch((err) => {
      console.error('[camera] autoStart failed', err);
    });
  }

  private async acquireCameraStream(sessionId: string): Promise<MediaStream> {
    // 1) Intento con video + audio (constraints simples, sin echoCancellation/noiseSuppression
    //    que algunos WebViews Android descartan silenciosamente).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' } },
        audio: true,
      });
      const audioTracks = stream.getAudioTracks().length;
      console.log('[camera] getUserMedia v+a ok, audioTracks=', audioTracks);
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"B",location:"edge/camera-streamer.component.ts:acquireCameraStream:va",msg:"[DEBUG] v+a stream acquired",data:{sessionId,audioTracks,videoTracks:stream.getVideoTracks().length},ts:Date.now()})}).catch(()=>{});
      return stream;
    } catch (err) {
      console.warn('[camera] v+a failed, falling back to video-only', err);
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"B",location:"edge/camera-streamer.component.ts:acquireCameraStream:va-fail",msg:"[DEBUG] v+a failed, fallback to video",data:{sessionId,errorName:err instanceof Error ? err.name : typeof err,errorMessage:err instanceof Error ? err.message : String(err)},ts:Date.now()})}).catch(()=>{});
    }
    // 2) Fallback: solo video (la cámara sigue funcionando aunque el mic falle).
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'user' } },
    });
    console.log('[camera] getUserMedia video-only ok, videoTracks=', stream.getVideoTracks().length);
    return stream;
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
    this.viewReadyForTemplate.set(true);
    console.log('[camera] ngAfterViewInit viewReady=true');
    // Si pendingRequest ya estaba seteado cuando la vista se montó,
    // reintentamos el auto-start ahora que viewReady es true.
    this.tryAutoStart();
    // #region debug-point E:view-ready
    fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"E",location:"edge/camera-streamer.component.ts:ngAfterViewInit",msg:"[DEBUG] camera view ready",data:{activeSessionId:this.activeSessionId()},ts:Date.now()})}).catch(()=>{});
    // #endregion
  }

  ngOnDestroy(): void {
    this.pendingSub?.unsubscribe();
    void this.stop();
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
    // #region debug-point B:start-remote-session-entry
    console.log('[camera] startRemoteSession called', sessionId, { hasTurn: !!turn });
    fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"B",location:"edge/camera-streamer.component.ts:startRemoteSession:entry",msg:"[DEBUG] start remote session entry",data:{sessionId,hasTurn:!!turn,nativePlatform:Capacitor.isNativePlatform()},ts:Date.now()})}).catch(()=>{});
    // #endregion
    this.status.set('awaiting-answer');

    try {
      await this.stop(false);
      // #region debug-point B:start-remote-session
      console.log('[camera] stop completed, requesting permission');
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"B",location:"edge/camera-streamer.component.ts:startRemoteSession",msg:"[DEBUG] start remote session",data:{sessionId,hasTurn:!!turn},ts:Date.now()})}).catch(()=>{});
      // #endregion
      if (Capacitor.isNativePlatform()) {
        // #region debug-point B:permission-check
        console.log('[camera] requesting camera permission');
        fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"B",location:"edge/camera-streamer.component.ts:permission-check",msg:"[DEBUG] requesting camera permission",data:{sessionId},ts:Date.now()})}).catch(()=>{});
        // #endregion
        const permissionResult = await DeviceRuntime.ensureCameraPermission();
        // #region debug-point B:permission-result
        console.log('[camera] camera permission result', permissionResult);
        fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"B",location:"edge/camera-streamer.component.ts:permission-result",msg:"[DEBUG] camera permission result",data:{sessionId,granted:!!permissionResult?.granted,result:permissionResult},ts:Date.now()})}).catch(()=>{});
        // #endregion
        if (!permissionResult?.granted) {
          throw new Error('camera permission not granted');
        }
        const micResult = await DeviceRuntime.ensureMicrophonePermission();
        fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"B",location:"edge/camera-streamer.component.ts:mic-permission",msg:"[DEBUG] mic permission result",data:{sessionId,granted:!!micResult?.granted,result:micResult},ts:Date.now()})}).catch(()=>{});
        // No bloqueamos si el mic no se concede: caemos a video-only.
      }
      // Intentar primero con audio. Si falla (NotAllowedError típico cuando
      // el WebView no concede el mic), reintentamos solo video.
      this.stream = await this.acquireCameraStream(sessionId);
      // #region debug-point B:getusermedia-ok
      console.log('[camera] getUserMedia ok', this.stream.getTracks().length, 'tracks');
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"B",location:"edge/camera-streamer.component.ts:getUserMedia:ok",msg:"[DEBUG] getUserMedia resolved",data:{sessionId,trackCount:this.stream.getTracks().length},ts:Date.now()})}).catch(()=>{});
      // #endregion
      this.videoRef.nativeElement.srcObject = this.stream!;
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

      // Transceiver recvonly para que la web pueda mandarnos PTT (audio) incluso
      // si el getUserMedia local solo devolvió video.
      this.peer.addTransceiver('audio', { direction: 'recvonly' });

      this.signaling.joinSession({ sessionId, role: 'node' });

      // Espera a que la web se una a la sala session:xxx antes de enviar la
      // oferta. Sin esto, hay race condition: si la oferta llega a una sala
      // vacía (porque la web todavía no terminó su handshake HTTP→joinSession),
      // la web se queda en waiting-offer para siempre.
      // Timeout de 2s por si la web ya estaba en la sala antes de que
      // el backend pudiera emitirnos peer-joined.
      console.log('[camera] waiting for web peer-joined', sessionId);
      await this.signaling
        .peerJoined$
        .pipe(
          filter((p) => p.sessionId === sessionId && p.role === 'user'),
          take(1),
          timeout({ first: 2000, meta: { sessionId } }),
        )
        .toPromise()
        .catch(() => undefined);
      console.log('[camera] web is in the room, sending offer');

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
        if (event.track.kind === 'audio' && stream && this.remoteAudioRef) {
          this.remoteAudioRef.nativeElement.srcObject = stream;
          this.attachRemoteAudioAnalyser(stream);
        }
      };

      this.stream!.getTracks().forEach((track) => this.peer?.addTrack(track, this.stream!));

      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      // #region debug-point B:offer-created
      console.log('[camera] offer created', offer.type, !!offer.sdp);
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"B",location:"edge/camera-streamer.component.ts:offer-created",msg:"[DEBUG] local offer created",data:{sessionId,offerType:offer.type,hasSdp:!!offer.sdp},ts:Date.now()})}).catch(()=>{});
      // #endregion
      this.signaling.sendOffer({
        sessionId,
        sdp: { type: offer.type, sdp: offer.sdp ?? undefined },
      });
      this.signaling.clearPendingRequest(sessionId);
      this.pendingSessionId.set(sessionId);
    } catch (err) {
      // #region debug-point B:getusermedia-error
      console.error('[camera] remote session failed', err);
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"B",location:"edge/camera-streamer.component.ts:catch",msg:"[DEBUG] remote session failed",data:{sessionId,errorName:err instanceof Error ? err.name : typeof err,errorMessage:err instanceof Error ? err.message : String(err)},ts:Date.now()})}).catch(()=>{});
      // #endregion
      this.status.set('error');
      await this.stop();
    }
  }

  async acceptPendingRequest(): Promise<void> {
    const request = this.signaling.pendingRequest();
    if (!request || request.mode !== 'camera') {
      return;
    }

    await this.startRemoteSession(request.sessionId, request.turn?.urls ? request.turn : undefined);
  }

  /**
   * Fallback manual: lee la solicitud pendiente del servicio de señalización
   * (no de los signals locales) y arranca la cámara. Útil cuando el effect
   * automático no dispara por condiciones de timing.
   */
  async forceStartFromSignaling(): Promise<void> {
    const request = this.signaling.pendingRequest();
    console.log('[camera] forceStartFromSignaling', { hasRequest: !!request, mode: request?.mode });
    if (!request) {
      return;
    }
    if (request.mode !== 'camera') {
      return;
    }
    if (!this.viewReady()) {
      console.warn('[camera] forceStartFromSignaling: view not ready yet');
      return;
    }
    this.pendingSessionId.set(request.sessionId);
    if (this.activeSessionId() === request.sessionId) {
      return;
    }
    try {
      await this.startRemoteSession(request.sessionId, request.turn?.urls ? request.turn : undefined);
    } catch (err) {
      console.error('[camera] forceStartFromSignaling failed', err);
    }
  }

  dismissPendingRequest(): void {
    this.signaling.clearPendingRequest();
    this.pendingSessionId.set(null);
    this.status.set('idle');
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
    if (notifyEnd) {
      this.pendingSessionId.set(null);
    }
    this.detachAudioAnalyser();
    if (this.remoteAudioRef) {
      this.remoteAudioRef.nativeElement.srcObject = null;
    }
    this.outputLevel.set(0);
    this.remoteSpeaking.set(false);
  }

  private attachRemoteAudioAnalyser(stream: MediaStream): void {
    this.detachAudioAnalyser();
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
        this.outputLevel.set(Math.min(100, (avg / 128) * 100));
        const speaking = avg > 6;
        if (speaking !== this.remoteSpeaking()) {
          this.remoteSpeaking.set(speaking);
        }
        this.vuTimer = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      console.warn('[camera] cannot attach remote audio analyser', err);
    }
  }

  private detachAudioAnalyser(): void {
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
}
