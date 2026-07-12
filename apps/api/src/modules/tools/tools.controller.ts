import { Controller, Get, Param, Post } from '@nestjs/common';
import { ToolsService } from './tools.service';

@Controller('tools')
export class ToolsController {
  constructor(private readonly tools: ToolsService) {}

  @Post('speedtest')
  speedtest() {
    return this.tools.runSpeedtest();
  }

  @Get('uptime/:edgeNodeId')
  uptime(@Param('edgeNodeId') edgeNodeId: string) {
    return this.tools.uptimeHistory(edgeNodeId);
  }
}