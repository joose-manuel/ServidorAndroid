import { Module } from '@nestjs/common';
import { IntercomController } from './intercom.controller';
import { IntercomService } from './intercom.service';

@Module({
  controllers: [IntercomController],
  providers: [IntercomService],
  exports: [IntercomService],
})
export class IntercomModule {}