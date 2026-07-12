import { Body, Controller, Post } from '@nestjs/common';
import { ModemService } from './modem.service';
import { RebootModemRequestDto } from '@servidor/shared-dto';

@Controller('modem')
export class ModemController {
  constructor(private readonly modem: ModemService) {}

  @Post('reboot')
  reboot(@Body() dto: RebootModemRequestDto) {
    return this.modem.reboot(dto.reason);
  }
}