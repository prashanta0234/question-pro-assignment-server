import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { GroceriesModule } from '../groceries/groceries.module';
import { QueuesModule } from '../../queues/queues.module';
import { OrdersController } from './controllers/orders.controller';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderCommandService } from './services/order-command.service';
import { OrderQueryService } from './services/order-query.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    AuditModule,
    GroceriesModule,  // provides GroceryCacheService
    QueuesModule,     // provides QUEUE_ORDER + QUEUE_INVENTORY
  ],
  controllers: [OrdersController],
  providers: [OrderCommandService, OrderQueryService],
})
export class OrdersModule {}
