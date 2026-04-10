import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';

/**
 * Bootstraps the full NestJS application for E2E testing.
 * Mirrors the setup in main.ts (global prefix, validation pipe, guards, filters).
 *
 * REQUIRES: a running PostgreSQL and Redis instance.
 * Configure via environment variables (see .env.example).
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    providers: [
      { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
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
