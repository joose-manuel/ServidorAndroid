import { Injectable } from '@nestjs/common';
import { environment } from '../../environments/environment';
import { buildTurnCredentials } from '@servidor/shared-utils';
import { TurnCredentials } from '@servidor/shared-types';

@Injectable()
export class TurnCredentialsService {
  issue(edgeNodeId: string): TurnCredentials {
    const c = buildTurnCredentials(
      environment.turn.sharedSecret,
      edgeNodeId,
      environment.turn.credentialTtlSeconds,
    );
    return {
      urls: [environment.turn.serverUrl],
      username: c.username,
      credential: c.credential,
      ttlSeconds: c.ttlSeconds,
      expiresAt: c.expiresAt,
    };
  }
}