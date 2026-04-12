import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroceryItem } from './entities/grocery-item.entity';
import { GroceryCacheService } from './services/grocery-cache.service';
import { GroceryReadService } from './services/grocery-read.service';
import { GroceryCreateService } from './services/grocery-create.service';
import { GroceryUpdateService } from './services/grocery-update.service';
import { GroceryDeleteService } from './services/grocery-delete.service';
import { GroceryInventoryService } from './services/grocery-inventory.service';
import { GroceriesPublicController } from './controllers/groceries-public.controller';
import { GroceriesAdminController } from './controllers/groceries-admin.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroceryItem]),
    AuditModule,
  ],
  controllers: [
    GroceriesPublicController,
    GroceriesAdminController,
  ],
  providers: [
    GroceryCacheService,
    GroceryReadService,
    GroceryCreateService,
    GroceryUpdateService,
    GroceryDeleteService,
    GroceryInventoryService,
  ],
  exports: [
    GroceryReadService,
    GroceryCacheService,
  ],
})
export class GroceriesModule {}
