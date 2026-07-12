export interface RequestIntercomDto {
  edgeNodeId: string;
}

export interface SetIntercomMuteDto {
  sessionId: string;
  remote: boolean;
  muted: boolean;
}