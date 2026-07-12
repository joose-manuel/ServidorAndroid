import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { environment } from '../../environments/environment';
import { isPrivateIp, normalizeMac } from '@servidor/shared-utils';

@Injectable()
export class NetworkAuditService {
  private readonly logger = new Logger(NetworkAuditService.name);

  async scanNow(edgeNodeId: string): Promise<{ scannedAt: string; durationMs: number }> {
    const startedAt = Date.now();
    // Real implementation triggers the Edge Node scanner which does ARP/ICMP.
    return {
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    };
  }

  @Cron(`*/${Math.max(1, Math.round(environment.metrics.networkScanIntervalMs / 60000))} * * * *`, {
    name: 'network-scan',
  })
  scheduledNetworkScan(): void {
    this.logger.debug('Triggering scheduled network scan');
  }

  // Re-exports so the controllers can validate inputs without re-implementing.
  validateMac(mac: string): boolean {
    return normalizeMac(mac).length === 17;
  }

  validatePrivateIp(ip: string): boolean {
    return isPrivateIp(ip);
  }
}