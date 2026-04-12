import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

/**
 * Bootstraps the full NestJS application for E2E testing.
 * Mirrors the setup in main.ts (global prefix, validation pipe).
 *
 * Guards, interceptors, and filters are NOT re-registered here —
 * AppModule already provides them via APP_GUARD / APP_INTERCEPTOR / APP_FILTER.
 * Duplicating them would cause double-wrapping of responses and double-running guards.
 *
 * The throttler guard is overridden to always allow through so rate-limit
 * thresholds do not interfere with test assertions.
 *
 * REQUIRES: a running PostgreSQL and Redis instance.
 * Configure via environment variables (see .env.example).
 */
export async function createTestApp(): Promise<INestApplication> {
  // Disable rate limiting so per-IP thresholds do not interfere with test assertions.
  process.env.SKIP_THROTTLE = 'true';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
        return new BadRequestException({ error: 'VALIDATION_ERROR', message: messages });
      },
    }),
  );

  await app.init();
  return app;
}
