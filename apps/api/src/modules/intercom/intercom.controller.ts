import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { IntercomService } from './intercom.service';
import { TurnCredentialsService } from '../camera/turn-credentials.service';
import { RequestIntercomDto, SetIntercomMuteDto } from '@servidor/shared-dto';
import { WebRTCGateway } from '../webrtc/webrtc.gateway';

@Controller('intercom')
export class IntercomController {
  constructor(
    private readonly intercom: IntercomService,
    private readonly turn: TurnCredentialsService,
    private readonly webrtc: WebRTCGateway,
  ) {}

  @Post('session')
  request(@Body() dto: RequestIntercomDto, @Req() req: Request) {
    const session = this.intercom.request({
      edgeNodeId: dto.edgeNodeId,
      userId: (req as any).userId ?? 'unknown',
    });
    const turn = this.turn.issue(dto.edgeNodeId);
    this.webrtc.notifySessionRequested({
      sessionId: session.id,
      edgeNodeId: dto.edgeNodeId,
      mode: 'intercom',
      turn,
    });
    return { session, turn };
  }

  @Post('session/:id/mute')
  mute(@Param('id') id: string, @Body() dto: SetIntercomMuteDto) {
    return this.intercom.setMute(id, dto.remote ? 'remote' : 'local', dto.muted);
  }

  @Post('session/:id/end')
  end(@Param('id') id: string) {
    return this.intercom.end(id);
  }
}
