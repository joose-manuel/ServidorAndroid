import { Module } from '@nestjs/common';
import { IntercomController } from './intercom.controller';
import { IntercomService } from './intercom.service';
import { CameraModule } from '../camera/camera.module';
import { WebrtcModule } from '../webrtc/webrtc.module';

@Module({
  imports: [WebrtcModule, CameraModule],
  controllers: [IntercomController],
  providers: [IntercomService],
  exports: [IntercomService],
})
export class IntercomModule {}
