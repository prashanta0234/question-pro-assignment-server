import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import {
  appConfig,
  dbConfig,
  redisConfig,
  jwtConfig,
  businessConfig,
} from './config/app.config';
import { envValidationSchema } from './config/env.validation';
import { buildLoggerConfig } from './config/logger.config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
      load: [appConfig, dbConfig, redisConfig, jwtConfig, businessConfig],
    }),

    LoggerModule.forRoot(buildLoggerConfig()),

    DatabaseModule,
  ],
})
export class AppModule {}
