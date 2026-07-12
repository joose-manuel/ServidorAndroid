import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { UserEntity } from './entities/user.entity';
import { ModemEntity } from './entities/modem.entity';
import { DeviceEntity } from './entities/device.entity';
import { MetricEntity } from './entities/metric.entity';
import { AlertEntity } from './entities/alert.entity';
import { CameraSessionEntity } from './entities/camera-session.entity';
import { AudioSessionEntity } from './entities/audio-session.entity';
import { AuditLogEntity } from './entities/audit-log.entity';
import { EdgeNodeEntity } from './entities/edge-node.entity';

const nodeEnv = process.env['NODE_ENV'];
const envFilePaths =
  nodeEnv === 'production'
    ? ['infra/env/.env.prod', 'infra/env/.env']
    : nodeEnv === 'staging'
      ? ['infra/env/.env.staging', 'infra/env/.env']
      : ['infra/env/.env'];

for (const envFilePath of envFilePaths) {
  const absoluteEnvFilePath = resolve(process.cwd(), envFilePath);

  if (!existsSync(absoluteEnvFilePath)) {
    continue;
  }

  dotenv.config({ path: absoluteEnvFilePath });
  break;
}

const databaseUrl = process.env['DATABASE_URL'];
const databaseHost = process.env['DATABASE_HOST'] ?? '';
const useSsl =
  process.env['DATABASE_SSL'] === 'true' ||
  databaseHost.includes('supabase.co') ||
  databaseUrl?.includes('supabase.co') === true;

const appDataSource = new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? { url: databaseUrl }
    : {
        host: databaseHost,
        port: Number(process.env['DATABASE_PORT'] ?? 5432),
        username: process.env['DATABASE_USER'],
        password: process.env['DATABASE_PASSWORD'],
        database: process.env['DATABASE_NAME'],
      }),
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  entities: [
    UserEntity,
    ModemEntity,
    DeviceEntity,
    MetricEntity,
    AlertEntity,
    CameraSessionEntity,
    AudioSessionEntity,
    AuditLogEntity,
    EdgeNodeEntity,
  ],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});

export default appDataSource;
