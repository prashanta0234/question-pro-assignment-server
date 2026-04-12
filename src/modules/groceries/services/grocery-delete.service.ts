import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroceryItem } from '../entities/grocery-item.entity';
import { GroceryReadService } from './grocery-read.service';
import { GroceryCacheService } from './grocery-cache.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { RequestContext } from '../../../common/interfaces/request-context.interface';

@Injectable()
export class GroceryDeleteService {
  constructor(
    @InjectRepository(GroceryItem)
    private readonly repo: Repository<GroceryItem>,
    private readonly readService: GroceryReadService,
    private readonly cacheService: GroceryCacheService,
    private readonly auditService: AuditService,
  ) {}

  async softDelete(id: string, ctx: RequestContext): Promise<void> {
    const item = await this.readService.findByIdOrFail(id);

    await this.repo.softDelete(id);

    setImmediate(() => {
      void this.cacheService.invalidateAll();
      void this.cacheService.deleteItem(id);
    });

    void this.auditService.log({
      ...ctx,
      action: AuditAction.GROCERY_DELETED,
      entity: 'GroceryItem',
      entityId: id,
      status: 'SUCCESS',
      beforeData: { id: item.id, name: item.name, description: item.description, price: item.price, stock: item.stock, lowStockNotified: item.lowStockNotified },
    });
  }
}
