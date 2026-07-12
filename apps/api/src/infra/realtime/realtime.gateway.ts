import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SUPABASE_CHANNELS, SUPABASE_EVENTS } from '@servidor/shared-supabase';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class RealtimeGateway {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('subscribe')
  onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { channel: string },
  ): { ok: true; channel: string } {
    client.join(payload.channel);
    this.logger.debug(`socket ${client.id} joined ${payload.channel}`);
    return { ok: true, channel: payload.channel };
  }

  publishMetrics(edgeNodeId: string, metrics: unknown): void {
    this.server.to(SUPABASE_CHANNELS.metrics(edgeNodeId)).emit(SUPABASE_EVENTS.metricsUpdate, metrics);
  }

  publishAlert(edgeNodeId: string, alert: unknown): void {
    this.server.to(SUPABASE_CHANNELS.alerts(edgeNodeId)).emit(SUPABASE_EVENTS.alertNew, alert);
  }
}