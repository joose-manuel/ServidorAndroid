import { Body, Controller, Post } from '@nestjs/common';
import { NetworkAuditService } from './network-audit.service';
import { TriggerNetworkScanDto } from '@servidor/shared-dto';

@Controller('network-audit')
export class NetworkAuditController {
  constructor(private readonly svc: NetworkAuditService) {}

  @Post('scan')
  scan(@Body() dto: TriggerNetworkScanDto) {
    return this.svc.scanNow(dto.edgeNodeId);
  }
}