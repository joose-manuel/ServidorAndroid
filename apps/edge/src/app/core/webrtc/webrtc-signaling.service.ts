import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import {
  WebrtcAnswerPayload,
  WebrtcIceCandidatePayload,
  WebrtcJoinSessionPayload,
  WebrtcOfferPayload,
  WebrtcSessionRequestedPayload,
} from '@servidor/shared-types';
import { ServerConfigService } from '../config/server-config.service';
import { DeviceIdentityService } from '../device/device-identity.service';

@Injectable({ providedIn: 'root' })
export class WebrtcSignalingService {
  private readonly server = inject(ServerConfigService);
  private readonly identity = inject(DeviceIdentityService);
  private socket: Socket | null = null;

  readonly pendingRequest = signal<WebrtcSessionRequestedPayload | null>(null);
  readonly offer$ = new Subject<WebrtcOfferPayload>();
  readonly answer$ = new Subject<WebrtcAnswerPayload>();
  readonly iceCandidate$ = new Subject<WebrtcIceCandidatePayload>();
  readonly sessionEnded$ = new Subject<{ sessionId: string }>();
  /** Emite cada vez que llega un session-requested nuevo (idempotente: se puede subscribir varias veces). */
  readonly sessionRequested$ = new Subject<WebrtcSessionRequestedPayload>();
  /** Emite cuando el otro peer (la web) se une a la sala session:xxx. */
  readonly peerJoined$ = new Subject<{ sessionId: string; role: 'user' | 'node' }>();

  start(): void {
    const namespaceUrl = this.namespaceUrl();
    // #region debug-point D:namespace-url
    fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"pre-fix",hypothesisId:"D",location:"edge/webrtc-signaling.service.ts:start",msg:"[DEBUG] start signaling",data:{namespaceUrl,hasSocket:!!this.socket},ts:Date.now()})}).catch(()=>{});
    // #endregion
    if (!namespaceUrl) {
      return;
    }

    if (this.socket?.connected) {
      this.registerNode();
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(namespaceUrl, {
      transports: ['websocket'],
      reconnection: true,
    });
    this.socket.on('connect', () => {
      // #region debug-point D:socket-connect
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"pre-fix",hypothesisId:"D",location:"edge/webrtc-signaling.service.ts:connect",msg:"[DEBUG] socket connected",data:{socketId:this.socket?.id ?? null},ts:Date.now()})}).catch(()=>{});
      // #endregion
      this.registerNode();
    });
    this.socket.on('connect_error', (error: Error) => {
      // #region debug-point D:connect-error
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"pre-fix",hypothesisId:"D",location:"edge/webrtc-signaling.service.ts:connect_error",msg:"[DEBUG] socket connect error",data:{message:error.message},ts:Date.now()})}).catch(()=>{});
      // #endregion
    });
    this.socket.on('session-requested', (payload: WebrtcSessionRequestedPayload) => {
      // #region debug-point A:session-requested
      console.log('[signaling] session-requested received', payload.sessionId, payload.mode);
      fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"post-fix",hypothesisId:"A",location:"edge/webrtc-signaling.service.ts:session-requested",msg:"[DEBUG] session requested received",data:{sessionId:payload.sessionId,mode:payload.mode,hasTurn:!!payload.turn},ts:Date.now()})}).catch(()=>{});
      // #endregion
      this.pendingRequest.set(payload);
      this.sessionRequested$.next(payload);
    });
    this.socket.on('offer', (payload: WebrtcOfferPayload) => this.offer$.next(payload));
    this.socket.on('answer', (payload: WebrtcAnswerPayload) => this.answer$.next(payload));
    this.socket.on('ice-candidate', (payload: WebrtcIceCandidatePayload) =>
      this.iceCandidate$.next(payload),
    );
    this.socket.on('session-ended', (payload: { sessionId: string }) => {
      if (this.pendingRequest()?.sessionId === payload.sessionId) {
        this.pendingRequest.set(null);
      }
      this.sessionEnded$.next(payload);
    });
    this.socket.on('peer-joined', (payload: { sessionId: string; role: 'user' | 'node' }) => {
      console.log('[signaling] peer-joined', payload.role, payload.sessionId);
      this.peerJoined$.next(payload);
    });
  }

  joinSession(payload: WebrtcJoinSessionPayload): void {
    this.socket?.emit('join-session', payload);
  }

  sendOffer(payload: WebrtcOfferPayload): void {
    this.socket?.emit('offer', payload);
  }

  sendIceCandidate(payload: WebrtcIceCandidatePayload): void {
    this.socket?.emit('ice-candidate', payload);
  }

  endSession(sessionId: string, durationSeconds: number): void {
    this.socket?.emit('session-end', { sessionId, durationSeconds });
  }

  clearPendingRequest(sessionId?: string): void {
    if (!sessionId || this.pendingRequest()?.sessionId === sessionId) {
      this.pendingRequest.set(null);
    }
  }

  private registerNode(): void {
    const nodeId = this.identity.deviceId();
    // #region debug-point D:register-node
    fetch("http://192.168.1.11:7777/event",{method:"POST",body:JSON.stringify({sessionId:"camera-offer-stall",runId:"pre-fix",hypothesisId:"D",location:"edge/webrtc-signaling.service.ts:registerNode",msg:"[DEBUG] register node emit",data:{nodeId},ts:Date.now()})}).catch(()=>{});
    // #endregion
    this.socket?.emit('register-node', {
      nodeId,
      deviceId: nodeId,
    });
  }

  private namespaceUrl(): string | null {
    const apiBaseUrl = this.server.apiBaseUrl();
    if (!apiBaseUrl) {
      return null;
    }

    const origin = new URL(apiBaseUrl).origin;
    return `${origin}/webrtc`;
  }
}
