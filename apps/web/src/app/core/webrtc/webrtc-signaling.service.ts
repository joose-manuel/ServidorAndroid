import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import {
  WebrtcAnswerPayload,
  WebrtcIceCandidatePayload,
  WebrtcJoinSessionPayload,
  WebrtcOfferPayload,
} from '@servidor/shared-types';
import { ServerConfigService } from '../config/server-config.service';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class WebrtcSignalingService {
  private readonly server = inject(ServerConfigService);
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;

  readonly offer$ = new Subject<WebrtcOfferPayload>();
  readonly answer$ = new Subject<WebrtcAnswerPayload>();
  readonly iceCandidate$ = new Subject<WebrtcIceCandidatePayload>();
  readonly sessionEnded$ = new Subject<{ sessionId: string }>();

  connect(nodeId: string): void {
    const namespaceUrl = this.namespaceUrl();
    if (!namespaceUrl) {
      return;
    }

    if (this.socket?.connected) {
      this.socket.emit('register-user', {
        userId: this.auth.user()?.id ?? 'viewer',
        nodeId,
      });
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
      this.socket?.emit('register-user', {
        userId: this.auth.user()?.id ?? 'viewer',
        nodeId,
      });
    });
    this.socket.on('offer', (payload: WebrtcOfferPayload) => this.offer$.next(payload));
    this.socket.on('answer', (payload: WebrtcAnswerPayload) => this.answer$.next(payload));
    this.socket.on('ice-candidate', (payload: WebrtcIceCandidatePayload) =>
      this.iceCandidate$.next(payload),
    );
    this.socket.on('session-ended', (payload: { sessionId: string }) => this.sessionEnded$.next(payload));
  }

  joinSession(payload: WebrtcJoinSessionPayload): void {
    this.socket?.emit('join-session', payload);
  }

  sendAnswer(payload: WebrtcAnswerPayload & { userId?: string; nodeId?: string; mode?: 'camera' | 'intercom' }): void {
    this.socket?.emit('answer', payload);
  }

  sendIceCandidate(payload: WebrtcIceCandidatePayload): void {
    this.socket?.emit('ice-candidate', payload);
  }

  endSession(sessionId: string, durationSeconds: number): void {
    this.socket?.emit('session-end', { sessionId, durationSeconds });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
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
