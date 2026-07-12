export type EdgeNodeStatus = 'online' | 'degraded' | 'offline';

export interface EdgeNode {
  id: string;
  name: string;
  model: string;
  osVersion: string;
  appVersion: string;
  status: EdgeNodeStatus;
  publicIp?: string;
  lastHeartbeatAt?: string;
  registeredAt: string;
}

export interface EdgeHeartbeat {
  edgeNodeId: string;
  status: EdgeNodeStatus;
  uptimeSeconds: number;
  batteryLevelPercent: number;
  reportedAt: string;
}