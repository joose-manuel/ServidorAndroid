import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CameraSession } from '@servidor/shared-types';

@Injectable()
export class CameraService {
  private sessions = new Map<string, CameraSession>();

  requestSession(opts: {
    edgeNodeId: string;
    userId: string;
    facing?: 'front' | 'back';
  }): CameraSession {
    const session: CameraSession = {
      id: randomUUID(),
      edgeNodeId: opts.edgeNodeId,
      startedByUserId: opts.userId,
      startedAt: new Date().toISOString(),
      facing: opts.facing ?? 'back',
      status: 'requested',
      encrypted: true,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  end(id: string): CameraSession | undefined {
    const s = this.sessions.get(id);
    if (!s) return undefined;
    s.status = 'ended';
    s.endedAt = new Date().toISOString();
    if (s.startedAt) {
      s.durationSeconds = Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000);
    }
    return s;
  }
}