import { Module } from '@nestjs/common';
import { WebRTCGateway } from './webrtc.gateway';
import { SupabaseService } from '../../shared/supabase.service';

@Module({
  providers: [WebRTCGateway, SupabaseService],
  exports: [WebRTCGateway],
})
export class WebrtcModule {}
