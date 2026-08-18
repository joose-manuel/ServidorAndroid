import { createHmac } from 'crypto';

/**
 * Build short-lived TURN credentials as described in the
 * Edge Node architecture doc, section 11.4 (WebRTC security).
 *
 * Username format: `<unix-timestamp-expiry>:<edge-node-id>`
 * Password = HMAC-SHA1(sharedSecret, username)
 *
 * @see https://datatracker.ietf.org/doc/html/draft-uberti-rtcweb-turn-rest-00
 */
export function buildTurnCredentials(
  sharedSecret: string,
  edgeNodeId: string,
  ttlSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): { username: string; credential: string; ttlSeconds: number; expiresAt: string } {
  const expiresAt = nowSeconds + ttlSeconds;
  const username = `${expiresAt}:${edgeNodeId}`;
  const credential = createHmac('sha1', sharedSecret).update(username).digest('base64');
  return {
    username,
    credential,
    ttlSeconds,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}