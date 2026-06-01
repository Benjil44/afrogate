import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 7000);
  const host = process.env.HOST ?? '127.0.0.1';

  app.setGlobalPrefix('api');

  // App-layer security headers — defense in depth if the API is ever exposed
  // without the hardened Nginx layer. The API only returns JSON, so a strict
  // CSP plus framing/sniffing protections are safe here.
  app.use((_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    next();
  });

  // Fail closed: never reflect arbitrary origins. With no explicit allowlist we
  // disable cross-origin requests (same-origin only, e.g. behind Nginx in prod).
  const corsOrigins = process.env.CORS_ORIGIN
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!corsOrigins || corsOrigins.length === 0) {
    console.warn('CORS_ORIGIN is not set; cross-origin requests are disabled (same-origin only). Set CORS_ORIGIN for local dev.');
  }
  app.enableCors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : false,
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
