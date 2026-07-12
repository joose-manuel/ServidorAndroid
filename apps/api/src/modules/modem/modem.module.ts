import { Module } from '@nestjs/common';
import { ModemController } from './modem.controller';
import { ModemService } from './modem.service';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [AlertsModule],
  controllers: [ModemController],
  providers: [ModemService],
  exports: [ModemService],
})
export class ModemModule {}
