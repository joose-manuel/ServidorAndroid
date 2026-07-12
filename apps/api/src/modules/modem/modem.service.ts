import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { environment } from '../../environments/environment';
import { AlertsService } from '../alerts/alerts.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ModemService {
  private readonly logger = new Logger(ModemService.name);
  private lastRebootAt: string | null = null;
  private lastReason: string | null = null;

  constructor(private readonly alerts: AlertsService) {}

  async reboot(reason?: string): Promise<{ ok: true; sentAt: string }> {
    const sentAt = new Date().toISOString();
    this.logger.warn(`Modem reboot requested: ${reason ?? 'no reason'}`);
    // Real implementation POSTs to /api/login.cgi + reboot endpoint.
    // The Edge Node app forwards the actual reboot call to the modem.
    this.lastRebootAt = sentAt;
    this.lastReason = reason ?? 'manual';
    this.alerts.push({
      id: randomUUID(),
      edgeNodeId: 'global',
      category: 'modem_reboot',
      severity: 'warning',
      title: 'Reinicio de modem solicitado',
      message: `Se envio un reinicio de modem: ${this.lastReason}.`,
      createdAt: sentAt,
    });
    return { ok: true, sentAt };
  }

  status(): {
    state: 'online';
    modemIp: string;
    lastRebootAt: string | null;
    lastReason: string | null;
  } {
    return {
      state: 'online',
      modemIp: environment.modem.defaultIp,
      lastRebootAt: this.lastRebootAt,
      lastReason: this.lastReason,
    };
  }

  async runCronIfDue(): Promise<void> {
    // Hook for @Cron-managed jobs (Sprint 1, HU-03).
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: 'modem-nightly-reboot' })
  scheduledNightlyReboot(): void {
    if (environment.production) {
      this.reboot('cron nightly').catch((err) => this.logger.error(err));
    }
  }
}
