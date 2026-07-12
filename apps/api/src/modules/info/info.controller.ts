import { Controller, Get } from '@nestjs/common';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface InfoResponse {
  tunnelUrl: string | null;
  tunnelActive: boolean;
  apiPort: number;
  apiVersion: string;
  timestamp: string;
}

const TUNNEL_FILE_CANDIDATES = [
  join(process.cwd(), '..', '..', 'infra', 'tunnel', '.tunnel-url'),
  join(process.cwd(), '..', 'infra', 'tunnel', '.tunnel-url'),
  join(process.cwd(), 'infra', 'tunnel', '.tunnel-url'),
  '/data/data/com.termux/files/home/servidorandroid/infra/tunnel/.tunnel-url',
];

function readTunnelUrl(): string | null {
  for (const path of TUNNEL_FILE_CANDIDATES) {
    if (existsSync(path)) {
      try {
        const url = readFileSync(path, 'utf8').trim();
        if (url.startsWith('https://')) {
          return url.replace(/\/+$/, '') + '/api';
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

@Controller('info')
export class InfoController {
  @Get()
  getInfo(): InfoResponse {
    const tunnelUrl = readTunnelUrl();
    return {
      tunnelUrl,
      tunnelActive: tunnelUrl !== null,
      apiPort: Number(process.env['API_PORT'] ?? 3000),
      apiVersion: process.env['npm_package_version'] ?? '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}