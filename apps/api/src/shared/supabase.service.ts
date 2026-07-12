import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

interface EdgeNodeRecord {
  id: string;
  user_id: string;
}

interface WebRtcSessionRecord {
  id: string;
}

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase!: SupabaseClient;

  onModuleInit() {
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('SUPABASE_URL y SUPABASE_ANON_KEY son requeridas');
    }

    this.supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
    );
  }

  // ========== DATABASE OPERATIONS ==========

  async getEdgeNode(nodeId: string) {
    return this.supabase
      .from('edge_nodes')
      .select('*')
      .eq('id', nodeId)
      .single<EdgeNodeRecord>();
  }

  async getEdgeNodeByDeviceId(deviceId: string) {
    return this.supabase
      .from('edge_nodes')
      .select('*')
      .eq('device_id', deviceId)
      .single<EdgeNodeRecord>();
  }

  async getUserEdgeNodes(userId: string) {
    return this.supabase
      .from('edge_nodes')
      .select('*')
      .eq('user_id', userId);
  }

  async createEdgeNode(userId: string, data: any) {
    return this.supabase
      .from('edge_nodes')
      .insert({
        user_id: userId,
        device_id: data.deviceId,
        name: data.name,
        ip_address: data.ipAddress,
      })
      .select()
      .single();
  }

  async updateEdgeNodeStatus(nodeId: string, status: 'online' | 'offline' | 'streaming') {
    return this.supabase
      .from('edge_nodes')
      .update({
        status,
        last_heartbeat: new Date().toISOString(),
      })
      .eq('id', nodeId)
      .select()
      .single();
  }

  async insertMetrics(edgeNodeId: string, metrics: any) {
    return this.supabase.from('metrics').insert({
      edge_node_id: edgeNodeId,
      latency: metrics.latency,
      bandwidth: metrics.bandwidth,
      battery: metrics.battery,
      device_count: metrics.deviceCount,
    });
  }

  async getLatestMetrics(edgeNodeId: string) {
    return this.supabase
      .from('metrics')
      .select('*')
      .eq('edge_node_id', edgeNodeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
  }

  async insertWebRTCSession(data: { edgeNodeId: string; userId: string; sessionType: string }) {
    return this.supabase.from('webrtc_sessions').insert({
      edge_node_id: data.edgeNodeId,
      user_id: data.userId,
      session_type: data.sessionType,
      started_at: new Date().toISOString(),
    })
    .select()
    .single<WebRtcSessionRecord>();
  }

  async endWebRTCSession(sessionId: string, durationSeconds: number) {
    return this.supabase
      .from('webrtc_sessions')
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('id', sessionId);
  }

  async insertNetworkDevice(edgeNodeId: string, device: any) {
    return this.supabase
      .from('network_devices')
      .upsert({
        edge_node_id: edgeNodeId,
        mac_address: device.macAddress,
        ip_address: device.ipAddress,
        device_name: device.deviceName,
        is_known: device.isKnown,
        last_seen: new Date().toISOString(),
      });
  }

  async insertAlert(edgeNodeId: string, alert: any) {
    return this.supabase.from('alerts').insert({
      edge_node_id: edgeNodeId,
      alert_type: alert.alertType,
      title: alert.title,
      description: alert.description,
      severity: alert.severity || 'info',
    });
  }

  // ========== REALTIME OPERATIONS ==========

  subscribeToMetrics(
    edgeNodeId: string,
    callback: (payload: any) => void
  ): RealtimeChannel {
    return this.supabase
      .channel(`metrics:${edgeNodeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'metrics',
          filter: `edge_node_id=eq.${edgeNodeId}`,
        },
        callback
      )
      .subscribe();
  }

  subscribeToEdgeNodeStatus(
    edgeNodeId: string,
    callback: (payload: any) => void
  ): RealtimeChannel {
    return this.supabase
      .channel(`edge-node:${edgeNodeId}:status`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'edge_nodes',
          filter: `id=eq.${edgeNodeId}`,
        },
        callback
      )
      .subscribe();
  }

  subscribeToAlerts(
    edgeNodeId: string,
    callback: (payload: any) => void
  ): RealtimeChannel {
    return this.supabase
      .channel(`alerts:${edgeNodeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
          filter: `edge_node_id=eq.${edgeNodeId}`,
        },
        callback
      )
      .subscribe();
  }

  // ========== BROADCAST CHANNELS ==========

  async broadcastSignal(nodeId: string, signal: any) {
    const channel = this.supabase.channel(`edge-node:${nodeId}:signals`);
    await channel.send({ type: 'broadcast', event: 'SIGNAL', payload: signal });
  }

  subscribeToSignals(
    nodeId: string,
    callback: (payload: any) => void
  ): RealtimeChannel {
    return this.supabase
      .channel(`edge-node:${nodeId}:signals`)
      .on('broadcast', { event: 'SIGNAL' }, callback)
      .subscribe();
  }

  async broadcastMetrics(nodeId: string, metrics: any) {
    const channel = this.supabase.channel(`edge-node:${nodeId}:metrics`);
    await channel.send({ type: 'broadcast', event: 'METRICS', payload: metrics });
  }

  subscribeToMetricsStream(
    nodeId: string,
    callback: (payload: any) => void
  ): RealtimeChannel {
    return this.supabase
      .channel(`edge-node:${nodeId}:metrics`)
      .on('broadcast', { event: 'METRICS' }, callback)
      .subscribe();
  }

  async broadcastControl(nodeId: string, command: any) {
    const channel = this.supabase.channel(`edge-node:${nodeId}:control`);
    await channel.send({ type: 'broadcast', event: 'CONTROL', payload: command });
  }

  subscribeToControl(
    nodeId: string,
    callback: (payload: any) => void
  ): RealtimeChannel {
    return this.supabase
      .channel(`edge-node:${nodeId}:control`)
      .on('broadcast', { event: 'CONTROL' }, callback)
      .subscribe();
  }

  // ========== CLEANUP ==========

  unsubscribe(channel: RealtimeChannel) {
    if (channel) {
      this.supabase.removeChannel(channel);
    }
  }
}
