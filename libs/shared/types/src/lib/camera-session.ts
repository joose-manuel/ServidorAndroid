export type CameraFacing = 'front' | 'back';
export type CameraSessionStatus = 'requested' | 'active' | 'ended' | 'denied' | 'failed';

export interface CameraSession {
  id: string;
  edgeNodeId: string;
  startedByUserId: string;
  startedAt: string;
  endedAt?: string;
  facing: CameraFacing;
  status: CameraSessionStatus;
  durationSeconds?: number;
  encrypted: boolean;
}