import { Controller, Get, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsQueryDto } from '@servidor/shared-dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly svc: AlertsService) {}

  @Get()
  list(@Query() q: AlertsQueryDto) {
    return this.svc.list({ severity: q.severity, acknowledged: q.acknowledged });
  }
}