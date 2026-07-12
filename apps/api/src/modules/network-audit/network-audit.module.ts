import { Module } from '@nestjs/common';
import { NetworkAuditController } from './network-audit.controller';
import { NetworkAuditService } from './network-audit.service';

@Module({
  controllers: [NetworkAuditController],
  providers: [NetworkAuditService],
  exports: [NetworkAuditService],
})
export class NetworkAuditModule {}