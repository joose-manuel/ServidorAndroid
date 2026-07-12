import { Controller, Get } from '@nestjs/common';

interface InfoResponse {
  apiPort: number;
  apiVersion: string;
  timestamp: string;
}

@Controller('info')
export class InfoController {
  @Get()
  getInfo(): InfoResponse {
    return {
      apiPort: Number(process.env['API_PORT'] ?? 3000),
      apiVersion: process.env['npm_package_version'] ?? '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}