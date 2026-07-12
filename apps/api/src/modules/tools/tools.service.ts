import { Injectable } from '@nestjs/common';

@Injectable()
export class ToolsService {
  async runSpeedtest(): Promise<{ downloadMbps: number; uploadMbps: number; pingMs: number }> {
    // Real impl: trigger speedtest-cli on the Edge Node and stream back.
    return { downloadMbps: 0, uploadMbps: 0, pingMs: 0 };
  }

  uptimeHistory(_edgeNodeId: string): Array<{ date: string; uptimePercent: number }> {
    // Real impl: aggregate from DB.
    return [];
  }
}