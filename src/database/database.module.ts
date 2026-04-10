import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('db.host'),
        port: config.get<number>('db.port'),
        username: config.get<string>('db.username'),
        password: config.get<string>('db.password'),
        database: config.get<string>('db.name'),

        entities: [__dirname + '/../**/*.entity{.ts,.js}'],

        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: true,

        synchronize: false,

        logging:
          config.get<string>('app.nodeEnv') === 'development'
            ? ['error', 'warn', 'migration']
            : ['error', 'migration'],

        extra: {
          max: 20,
          min: 5,
          idleTimeoutMillis: 10_000,
          connectionTimeoutMillis: 30_000,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
