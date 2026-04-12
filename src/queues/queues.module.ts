import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroceryItem } from '../modules/groceries/entities/grocery-item.entity';
import { AuditModule } from '../modules/audit/audit.module';
import { QUEUE_INVENTORY, QUEUE_ORDER } from './constants/queue-names.const';
import { OrderProcessor } from './processors/order.processor';
import { InventoryProcessor } from './processors/inventory.processor';

@Module({
  imports: [
    /**
     * BullMQ uses Redis db1 (isolated from cache on db0).
     * ADR-005: single Redis instance, two logical databases.
     */
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password') || undefined,
          db: 1, // db1 = BullMQ — isolated from cache db0
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_ORDER },
      { name: QUEUE_INVENTORY },
    ),
    TypeOrmModule.forFeature([GroceryItem]),
    AuditModule,
  ],
  providers: [OrderProcessor, InventoryProcessor],
  exports: [
    BullModule, // exports registered queues so OrdersModule can inject them
  ],
})
export class QueuesModule {}
