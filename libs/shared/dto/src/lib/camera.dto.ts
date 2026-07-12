export type CameraQuality = 'low' | 'medium' | 'high';

export interface RequestCameraSessionDto {
  edgeNodeId: string;
  quality: CameraQuality;
  facing?: 'front' | 'back';
}

export interface CameraSnapshotDto {
  edgeNodeId: string;
  requestedAt: string;
}

export interface SwitchCameraDto {
  sessionId: string;
  facing: 'front' | 'back';
}

export interface SetCameraQualityDto {
  sessionId: string;
  quality: CameraQuality;
}