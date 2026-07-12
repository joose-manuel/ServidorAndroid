import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditEventType } from '@servidor/shared-types';

@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly svc: AuditLogService) {}

  @Get()
  list(
    @Query('edgeNodeId') edgeNodeId?: string,
    @Query('userId') userId?: string,
    @Query('event') event?: AuditEventType,
  ) {
    return this.svc.list({ edgeNodeId, userId, event });
  }
}