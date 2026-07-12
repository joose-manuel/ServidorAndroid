import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { IntercomService } from './intercom.service';
import { RequestIntercomDto, SetIntercomMuteDto } from '@servidor/shared-dto';

@Controller('intercom')
export class IntercomController {
  constructor(private readonly intercom: IntercomService) {}

  @Post('session')
  request(@Body() dto: RequestIntercomDto, @Req() req: Request) {
    return this.intercom.request({
      edgeNodeId: dto.edgeNodeId,
      userId: (req as any).userId ?? 'unknown',
    });
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