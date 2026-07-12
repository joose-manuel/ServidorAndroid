import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { environment } from '../../environments/environment';

@Injectable()
export class ModemService {
  private readonly logger = new Logger(ModemService.name);

  async reboot(reason?: string): Promise<{ ok: true; sentAt: string }> {
    this.logger.warn(`Modem reboot requested: ${reason ?? 'no reason'}`);
    // Real implementation POSTs to /api/login.cgi + reboot endpoint.
    // The Edge Node app forwards the actual reboot call to the modem.
    return { ok: true, sentAt: new Date().toISOString() };
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