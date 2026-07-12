import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase.service';

@Injectable()
export class EdgeNodesService {
  constructor(private supabase: SupabaseService) {}

  async registerNode(userId: string, deviceId: string, name: string, ipAddress: string) {
    const { data, error } = await this.supabase.createEdgeNode(userId, {
      deviceId,
      name,
      ipAddress,
    });

    if (error) throw error;
    return data;
  }

  async getNodeForUser(userId: string, nodeId: string) {
    const { data, error } = await this.supabase.getEdgeNode(nodeId);
    if (error) throw error;
    if (data?.user_id !== userId) {
      throw new Error('Unauthorized');
    }
    return data;
  }

  async getUserNodes(userId: string) {
    const { data, error } = await this.supabase.getUserEdgeNodes(userId);
    if (error) throw error;
    return data;
  }

  async updateNodeStatus(nodeId: string, status: 'online' | 'offline' | 'streaming') {
    const { data, error } = await this.supabase.updateEdgeNodeStatus(nodeId, status);
    if (error) throw error;
    return data;
  }

  async handleNodeHeartbeat(deviceId: string, data: any) {
    // Find node by device ID
    const { data: node, error: findError } = 
      await this.supabase.getEdgeNodeByDeviceId(deviceId);
    
    if (findError || !node) {
      throw new Error('Node not found');
    }

    // Update status to online
    await this.updateNodeStatus(node.id, 'online');

    // Save metrics
    if (data.metrics) {
      await this.supabase.insertMetrics(node.id, data.metrics);
    }

    return node;
  }
}
