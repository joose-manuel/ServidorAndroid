import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NetworkAuditService } from './network-audit.service';
import { TriggerNetworkScanDto } from '@servidor/shared-dto';

@Controller('network-audit')
export class NetworkAuditController {
  constructor(private readonly svc: NetworkAuditService) {}

  @Get('last/:edgeNodeId')
  last(@Param('edgeNodeId') edgeNodeId: string) {
    return this.svc.last(edgeNodeId);
  }

  @Post('scan')
  scan(@Body() dto: TriggerNetworkScanDto) {
    return this.svc.scanNow(dto.edgeNodeId);
  }
}
