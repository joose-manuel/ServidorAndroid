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

  start(): void {
    const namespaceUrl = this.namespaceUrl();
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
    this.socket.on('connect', () => this.registerNode());
    this.socket.on('session-requested', (payload: WebrtcSessionRequestedPayload) =>
      this.pendingRequest.set(payload),
    );
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
