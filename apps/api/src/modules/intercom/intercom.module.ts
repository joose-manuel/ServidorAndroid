import { Module } from '@nestjs/common';
import { IntercomController } from './intercom.controller';
import { IntercomService } from './intercom.service';
import { WebrtcModule } from '../webrtc/webrtc.module';

@Module({
  imports: [WebrtcModule],
  controllers: [IntercomController],
  providers: [IntercomService],
  exports: [IntercomService],
})
export class IntercomModule {}
