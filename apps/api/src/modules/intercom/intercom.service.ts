import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AudioSession } from '@servidor/shared-types';

@Injectable()
export class IntercomService {
  private sessions = new Map<string, AudioSession>();

  request(opts: { edgeNodeId: string; userId: string }): AudioSession {
    const s: AudioSession = {
      id: randomUUID(),
      edgeNodeId: opts.edgeNodeId,
      startedByUserId: opts.userId,
      startedAt: new Date().toISOString(),
      status: 'requested',
      remoteMuted: false,
      localMuted: false,
    };
    this.sessions.set(s.id, s);
    return s;
  }

  setMute(id: string, channel: 'remote' | 'local', muted: boolean): AudioSession | undefined {
    const s = this.sessions.get(id);
    if (!s) return undefined;
    if (channel === 'remote') s.remoteMuted = muted;
    else s.localMuted = muted;
    return s;
  }

  end(id: string): AudioSession | undefined {
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