import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Subscription } from 'rxjs';
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
  private stream?: MediaStream;
  private peer?: RTCPeerConnection;
  private readonly viewReady = signal(false);
  private pendingSub?: Subscription;

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
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      // #region debug-point B:getusermedia-ok
      console.log('[camera] getUserMedia ok', this.stream.getTracks().length, 'tracks');
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"B",location:"edge/camera-streamer.component.ts:getUserMedia:ok",msg:"[DEBUG] getUserMedia resolved",data:{sessionId,trackCount:this.stream.getTracks().length},ts:Date.now()})}).catch(()=>{});
      // #endregion
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
  }
}
