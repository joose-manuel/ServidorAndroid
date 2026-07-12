import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { config as dotenvConfig } from 'dotenv';

// ── Pre-cargar .env ANTES de evaluar cualquier variable ──
const nodeEnv = process.env['NODE_ENV'];
const envFileCandidates = (
  nodeEnv === 'production'
    ? ['infra/env/.env.prod', 'infra/env/.env']
    : nodeEnv === 'staging'
      ? ['infra/env/.env.staging', 'infra/env/.env']
      : ['infra/env/.env']
);
for (const relativePath of envFileCandidates) {
  const abs = resolve(process.cwd(), relativePath);
  if (existsSync(abs)) {
    dotenvConfig({ path: abs, override: true });
    break;
  }
}

// ── Módulos ──
import { HealthModule } from '../modules/health/health.module';
import { InfoModule } from '../modules/info/info.module';
import { ModemModule } from '../modules/modem/modem.module';
import { NetworkAuditModule } from '../modules/network-audit/network-audit.module';
import { MetricsModule } from '../modules/metrics/metrics.module';
import { AlertsModule } from '../modules/alerts/alerts.module';
import { CameraModule } from '../modules/camera/camera.module';
import { IntercomModule } from '../modules/intercom/intercom.module';
import { ToolsModule } from '../modules/tools/tools.module';
import { AuditLogModule } from '../modules/audit-log/audit-log.module';
import { EdgeModule } from '../modules/edge/edge.module';
import { ContentModule } from '../modules/content/content.module';
import { AuthModule } from '../modules/auth/auth.module';

import { SupabaseModule } from '../infra/supabase/supabase.module';
import { RealtimeModule } from '../infra/realtime/realtime.module';
import { DatabaseModule } from '../infra/database/database.module';

const skipDb = process.env['SKIP_DATABASE'] === 'true';
Logger.log(
  `[AppModule] SKIP_DATABASE = ${process.env['SKIP_DATABASE']} → skipDb = ${skipDb}${skipDb ? ' — DatabaseModule y AuthModule NO cargados' : ' — carga completa con DB'}`,
  'AppModule',
);
const envFilePaths = envFileCandidates
  .map((relativePath) => resolve(process.cwd(), relativePath))
  .filter((absolutePath) => existsSync(absolutePath));

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: envFilePaths,
    }),
    ScheduleModule.forRoot(),
    ...(skipDb ? [] : [DatabaseModule]),
    ...(skipDb ? [] : [SupabaseModule]),
    RealtimeModule,
    HealthModule,
    InfoModule,
    ...(skipDb ? [] : [AuthModule]),
    ModemModule,
    NetworkAuditModule,
    MetricsModule,
    AlertsModule,
    CameraModule,
    IntercomModule,
    ToolsModule,
    AuditLogModule,
    EdgeModule,
    ContentModule,
  ],
})
export class AppModule {}
