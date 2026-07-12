import { Controller, Get, Post, Body, Param, NotFoundException, ConflictException } from '@nestjs/common';
import { EdgeStore } from './edge.store';

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

@Controller('edge')
export class EdgeController {
  constructor(private readonly store: EdgeStore) {}

  @Post('register')
  register(@Body() body: { deviceId: string }): { code: string; deviceId: string } {
    const existing = this.store.findByDeviceId(body.deviceId);
    if (existing && existing.paired) {
      throw new ConflictException('device already paired');
    }
    if (existing && !existing.paired) {
      return { code: existing.code, deviceId: existing.deviceId };
    }
    const code = generateCode();
    this.store.register(body.deviceId, code);
    return { code, deviceId: body.deviceId };
  }

  @Post('pair')
  pair(@Body() body: { code: string }): { deviceId: string; status: string } {
    if (!body.code || body.code.length !== 6) {
      throw new NotFoundException('invalid pairing code');
    }
    const device = this.store.pair(body.code);
    if (!device) {
      throw new NotFoundException('código inválido o expirado');
    }
    return { deviceId: device.deviceId, status: 'paired' };
  }

  @Get('status/:deviceId')
  status(@Param('deviceId') deviceId: string): { paired: boolean; pairedAt: string | null } {
    const device = this.store.findByDeviceId(deviceId);
    if (!device) {
      return { paired: false, pairedAt: null };
    }
    return { paired: device.paired, pairedAt: device.pairedAt };
  }

  @Post('unpair')
  unpair(@Body() body: { deviceId: string }): { ok: boolean } {
    const removed = this.store.unpair(body.deviceId);
    if (!removed) {
      throw new NotFoundException('device not found');
    }
    return { ok: true };
  }
}

