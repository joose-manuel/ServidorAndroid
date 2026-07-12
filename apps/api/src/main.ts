import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'] as const,
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix(environment.globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(environment.port, environment.host);
  Logger.log(
    `🚀 API listening on http://${environment.host}:${environment.port}/${environment.globalPrefix}`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  Logger.error(err, 'Bootstrap');
  process.exit(1);
});