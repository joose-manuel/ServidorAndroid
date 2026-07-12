import { Module } from '@nestjs/common';
import { CameraController } from './camera.controller';
import { CameraService } from './camera.service';
import { TurnCredentialsService } from './turn-credentials.service';
import { WebrtcModule } from '../webrtc/webrtc.module';

@Module({
  imports: [WebrtcModule],
  controllers: [CameraController],
  providers: [CameraService, TurnCredentialsService],
  exports: [CameraService, TurnCredentialsService],
})
export class CameraModule {}
