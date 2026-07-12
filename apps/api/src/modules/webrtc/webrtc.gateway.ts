import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SupabaseService } from '../../shared/supabase.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/webrtc',
  cors: { origin: '*' },
})
export class WebRTCGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebRTCGateway.name);
  private activeSessions: Map<string, any> = new Map();

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

  @SubscribeMessage('offer')
  async handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { nodeId: string; offer: any }
  ) {
    this.logger.log(`Offer received from node: ${data.nodeId}`);
    
    // Broadcast offer to all users connected to this node
    client.broadcast.to(`node:${data.nodeId}`).emit('offer', {
      nodeId: data.nodeId,
      offer: data.offer,
    });

    // Store in active sessions
    this.activeSessions.set(`${data.nodeId}:offer`, {
      nodeId: data.nodeId,
      offer: data.offer,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('answer')
  async handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { nodeId: string; userId: string; answer: any }
  ) {
    this.logger.log(`Answer received for node: ${data.nodeId}`);
    
    // Send answer to the node
    client.broadcast.to(`node:${data.nodeId}`).emit('answer', {
      userId: data.userId,
      answer: data.answer,
    });

    // Register WebRTC session in database
    const { data: nodeData } = await this.supabase.getEdgeNode(data.nodeId);
    if (nodeData) {
      const { data: session } = await this.supabase.insertWebRTCSession({
        edgeNodeId: data.nodeId,
        userId: data.userId,
        sessionType: 'camera',
      });
      
      if (session) {
        this.activeSessions.set(session.id, {
          sessionId: session.id,
          nodeId: data.nodeId,
          userId: data.userId,
          startTime: Date.now(),
        });
      }
    }
  }

  @SubscribeMessage('ice-candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { nodeId: string; userId: string; candidate: any }
  ) {
    this.logger.log(`ICE candidate from node: ${data.nodeId}`);
    
    // Broadcast candidate to both node and user
    if (data.userId) {
      client.broadcast.to(`user:${data.userId}:${data.nodeId}`).emit('ice-candidate', {
        nodeId: data.nodeId,
        candidate: data.candidate,
      });
    } else {
      client.broadcast.to(`node:${data.nodeId}`).emit('ice-candidate', {
        nodeId: data.nodeId,
        candidate: data.candidate,
      });
    }
  }

  @SubscribeMessage('session-end')
  async handleSessionEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; durationSeconds: number }
  ) {
    this.logger.log(`Session ended: ${data.sessionId}`);
    
    await this.supabase.endWebRTCSession(data.sessionId, data.durationSeconds);
    
    const sessionInfo = this.activeSessions.get(data.sessionId);
    if (sessionInfo) {
      this.activeSessions.delete(data.sessionId);
    }

    return { status: 'session ended' };
  }

  @SubscribeMessage('ping')
  handlePing(): string {
    return 'pong';
  }
}
