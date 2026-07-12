export type WebrtcSessionMode = 'camera' | 'intercom';
export type WebrtcPeerRole = 'viewer' | 'node';

export interface WebrtcSessionDescription {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback' | string;
  sdp?: string;
}

export interface WebrtcIceCandidateData {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface WebrtcJoinSessionPayload {
  sessionId: string;
  role: WebrtcPeerRole;
}

export interface WebrtcOfferPayload {
  sessionId: string;
  sdp: WebrtcSessionDescription;
}

export interface WebrtcAnswerPayload {
  sessionId: string;
  sdp: WebrtcSessionDescription;
}

export interface WebrtcIceCandidatePayload {
  sessionId: string;
  candidate: WebrtcIceCandidateData;
}

export interface WebrtcSessionRequestedPayload {
  sessionId: string;
  edgeNodeId: string;
  mode: WebrtcSessionMode;
  facing?: 'front' | 'back';
  turn?: {
    urls: string[];
    username: string;
    credential: string;
    ttlSeconds: number;
  };
}
