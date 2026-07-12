export type IntercomStatus = 'requested' | 'active' | 'muted' | 'ended' | 'failed';

export interface AudioSession {
  id: string;
  edgeNodeId: string;
  startedByUserId: string;
  startedAt: string;
  endedAt?: string;
  status: IntercomStatus;
  remoteMuted: boolean;
  localMuted: boolean;
  durationSeconds?: number;
}