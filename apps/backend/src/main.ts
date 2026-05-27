import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 7000);
  const host = process.env.HOST ?? '127.0.0.1';

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  await app.listen(port, host);
  console.log(`AfroGate backend listening on http://${host}:${port}/api`);
}

void bootstrap();
