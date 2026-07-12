import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseLoggerService } from './database-logger.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const dbLogger = new Logger('Database');

        const databaseUrl = cfg.get<string>('DATABASE_URL');
        const databaseHost = cfg.get<string>('DATABASE_HOST') ?? '';
        const useSsl =
          cfg.get<string>('DATABASE_SSL') === 'true' ||
          databaseHost.includes('supabase.co') ||
          databaseUrl?.includes('supabase.co') === true;

        dbLogger.log('Inicializando conexión...');

        return {
          type: 'postgres',
          ...(databaseUrl
            ? { url: databaseUrl }
            : {
                host: databaseHost,
                port: Number(cfg.get<string>('DATABASE_PORT') ?? 5432),
                username: cfg.get<string>('DATABASE_USER'),
                password: cfg.get<string>('DATABASE_PASSWORD'),
                database: cfg.get<string>('DATABASE_NAME'),
              }),
          ssl: useSsl ? { rejectUnauthorized: false } : undefined,
          entities: [__dirname + '/entities/*.entity.{ts,js}'],
          migrations: [__dirname + '/migrations/*.{ts,js}'],
          migrationsRun: false,
          synchronize: false,
          autoLoadEntities: true,
        };
      },
    }),
  ],
  providers: [DatabaseLoggerService],
})
export class DatabaseModule {}
