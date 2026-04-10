import { NestFactory } from '@nestjs/core';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';

import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));

  // ── Security headers (must be first middleware) ──────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false,     // API-only — no HTML served
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── Body size limit — prevents memory exhaustion ─────────────────────────
  // An order with 100 items is well under 10KB; 100KB is generous
  app.use(require('express').json({ limit: '100kb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '100kb' }));

  // ── Response compression ──────────────────────────────────────────────────
  app.use(compression());

  // ── CORS — explicit allowlist from env ────────────────────────────────────
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    credentials: true,
  });

  // ── Global prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Input validation ──────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
        return new BadRequestException({ error: 'VALIDATION_ERROR', message: messages });
      },
    }),
  );

  // ── Swagger (dev/staging only) ────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app);
  }

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 5000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);

  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger UI:   http://localhost:${port}/api/v1/docs`);
    logger.log(`OpenAPI JSON: http://localhost:${port}/api/v1/docs-json`);
  }
}

bootstrap();
