import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EdgeNodesService } from './edge-nodes.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { GetUser } from '../../decorators/get-user.decorator';

@Controller('edge-nodes')
@UseGuards(SupabaseAuthGuard)
export class EdgeNodesController {
  constructor(private readonly edgeNodesService: EdgeNodesService) {}

  @Post('register')
  async registerNode(
    @GetUser() user: { id: string },
    @Body() dto: { deviceId: string; name: string; ipAddress: string },
  ) {
    return this.edgeNodesService.registerNode(
      user.id,
      dto.deviceId,
      dto.name,
      dto.ipAddress,
    );
  }

  @Get()
  async getUserNodes(@GetUser() user: { id: string }) {
    return this.edgeNodesService.getUserNodes(user.id);
  }

  @Get(':nodeId')
  async getNode(
    @GetUser() user: { id: string },
    @Param('nodeId') nodeId: string,
  ) {
    return this.edgeNodesService.getNodeForUser(user.id, nodeId);
  }

  @Post('heartbeat')
  async handleHeartbeat(@Body() dto: { deviceId: string; metrics: unknown }) {
    return this.edgeNodesService.handleNodeHeartbeat(dto.deviceId, dto);
  }
}
