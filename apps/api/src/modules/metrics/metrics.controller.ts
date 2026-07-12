import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { ReportMetricsDto } from '@servidor/shared-dto';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly svc: MetricsService) {}

  @Get('current/:edgeNodeId')
  current(@Param('edgeNodeId') edgeNodeId: string) {
    return this.svc.current(edgeNodeId);
  }

  @Post('report')
  report(@Body() dto: ReportMetricsDto) {
    this.svc.ingest(dto.edgeNodeId, dto as unknown as Record<string, unknown>);
    return { ok: true };
  }
}