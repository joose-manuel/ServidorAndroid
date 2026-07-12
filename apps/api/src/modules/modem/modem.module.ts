import { Module } from '@nestjs/common';
import { ModemController } from './modem.controller';
import { ModemService } from './modem.service';

@Module({
  controllers: [ModemController],
  providers: [ModemService],
  exports: [ModemService],
})
export class ModemModule {}