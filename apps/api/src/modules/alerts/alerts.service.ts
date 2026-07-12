import { Injectable } from '@nestjs/common';
import { Alert } from '@servidor/shared-types';

@Injectable()
export class AlertsService {
  private alerts: Alert[] = [];

  list(opts: { edgeNodeId?: string; severity?: Alert['severity']; acknowledged?: boolean }): Alert[] {
    return this.alerts.filter(
      (a) =>
        (!opts.edgeNodeId || a.edgeNodeId === opts.edgeNodeId) &&
        (!opts.severity || a.severity === opts.severity) &&
        (opts.acknowledged === undefined || Boolean(a.acknowledgedAt) === opts.acknowledged),
    );
  }

  push(alert: Alert): void {
    this.alerts.unshift(alert);
  }
}
