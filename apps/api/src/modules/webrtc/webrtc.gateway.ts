import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { SupabaseService } from '../../shared/supabase.service';
import { Logger } from '@nestjs/common';
import {
  WebrtcAnswerPayload,
  WebrtcIceCandidatePayload,
  WebrtcJoinSessionPayload,
  WebrtcOfferPayload,
  WebrtcSessionRequestedPayload,
} from '@servidor/shared-types';

@WebSocketGateway({
  namespace: '/webrtc',
  cors: { origin: '*' },
})
export class WebRTCGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebRTCGateway.name);
  private activeSessions: Map<string, any> = new Map();
  @WebSocketServer() server!: Namespace;

  constructor(private supabase: SupabaseService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('register-node')
  async handleRegisterNode(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { nodeId: string; deviceId: string }
  ) {
    this.logger.log(`Node registered: ${data.nodeId}`);
    client.join(`node:${data.nodeId}`);
    return { status: 'ok' };
  }

  @SubscribeMessage('register-user')
  async handleRegisterUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; nodeId: string }
  ) {
    this.logger.log(`User registered: ${data.userId} for node ${data.nodeId}`);
    client.join(`user:${data.userId}:${data.nodeId}`);
    return { status: 'ok' };
  }

  @SubscribeMessage('join-session')
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WebrtcJoinSessionPayload,
  ) {
    this.logger.log(`Join session ${data.sessionId} as ${data.role}`);
    client.join(`session:${data.sessionId}`);
    return { status: 'ok' };
  }

  @SubscribeMessage('offer')
  async handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WebrtcOfferPayload,
  ) {
    this.logger.log(`Offer received for session: ${data.sessionId}`);
    client.broadcast.to(`session:${data.sessionId}`).emit('offer', {
      sessionId: data.sessionId,
      sdp: data.sdp,
    });
    this.activeSessions.set(`${data.sessionId}:offer`, {
      sessionId: data.sessionId,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('answer')
  async handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WebrtcAnswerPayload & { userId?: string; nodeId?: string; mode?: 'camera' | 'intercom' }
  ) {
    this.logger.log(`Answer received for session: ${data.sessionId}`);
    client.broadcast.to(`session:${data.sessionId}`).emit('answer', {
      sessionId: data.sessionId,
      sdp: data.sdp,
    });

    if (data.nodeId && data.userId) {
      const { data: nodeData } = await this.supabase.getEdgeNode(data.nodeId);
      if (!nodeData) {
        return;
      }
      const { data: session } = await this.supabase.insertWebRTCSession({
        edgeNodeId: data.nodeId,
        userId: data.userId,
        sessionType: data.mode ?? 'camera',
      });
      if (session) {
        this.activeSessions.set(data.sessionId, {
          sessionId: data.sessionId,
          nodeId: data.nodeId,
          userId: data.userId,
          dbSessionId: session.id,
          startTime: Date.now(),
        });
      }
    }
  }

  @SubscribeMessage('ice-candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WebrtcIceCandidatePayload
  ) {
    this.logger.log(`ICE candidate for session: ${data.sessionId}`);
    client.broadcast.to(`session:${data.sessionId}`).emit('ice-candidate', {
      sessionId: data.sessionId,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage('session-end')
  async handleSessionEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; durationSeconds: number }
  ) {
    this.logger.log(`Session ended: ${data.sessionId}`);
    
    const sessionInfo = this.activeSessions.get(data.sessionId);
    if (sessionInfo) {
      if (sessionInfo.dbSessionId) {
        await this.supabase.endWebRTCSession(sessionInfo.dbSessionId, data.durationSeconds);
      }
      this.activeSessions.delete(data.sessionId);
    }

    client.broadcast.to(`session:${data.sessionId}`).emit('session-ended', {
      sessionId: data.sessionId,
    });
    return { status: 'session ended' };
  }

  @SubscribeMessage('ping')
  handlePing(): string {
    return 'pong';
  }

  notifySessionRequested(payload: WebrtcSessionRequestedPayload): void {
    if (!this.server) {
      this.logger.warn(`Cannot notify session ${payload.sessionId}, gateway not ready`);
      return;
    }

    this.logger.log(`Notifying node ${payload.edgeNodeId} about ${payload.mode} session ${payload.sessionId}`);
    this.server.to(`node:${payload.edgeNodeId}`).emit('session-requested', payload);
  }
}
