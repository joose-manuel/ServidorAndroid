import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CameraService } from './camera.service';
import { TurnCredentialsService } from './turn-credentials.service';
import { RequestCameraSessionDto, SwitchCameraDto, SetCameraQualityDto } from '@servidor/shared-dto';

@Controller('camera')
export class CameraController {
  constructor(
    private readonly camera: CameraService,
    private readonly turn: TurnCredentialsService,
  ) {}

  @Post('session')
  requestSession(@Body() dto: RequestCameraSessionDto, @Req() req: Request) {
    const session = this.camera.requestSession({
      edgeNodeId: dto.edgeNodeId,
      userId: (req as any).userId ?? 'unknown',
      facing: dto.facing,
    });
    return { session, turn: this.turn.issue(dto.edgeNodeId) };
  }

  @Post('session/:id/end')
  end(@Param('id') id: string) {
    return this.camera.end(id);
  }

  @Post('session/switch')
  switch(@Body() dto: SwitchCameraDto) {
    return { ok: true, sessionId: dto.sessionId, facing: dto.facing };
  }

  @Post('session/quality')
  setQuality(@Body() dto: SetCameraQualityDto) {
    return { ok: true, sessionId: dto.sessionId, quality: dto.quality };
  }
}