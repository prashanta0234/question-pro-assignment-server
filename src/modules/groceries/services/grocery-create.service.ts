import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroceryItem } from '../entities/grocery-item.entity';
import { CreateGroceryDto } from '../dto/create-grocery.dto';
import { GroceryCacheService } from './grocery-cache.service';
import { IGroceryWriter } from '../interfaces/grocery-writer.interface';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { RequestContext } from '../../../common/interfaces/request-context.interface';

@Injectable()
export class GroceryCreateService implements Pick<IGroceryWriter, 'create'> {
  constructor(
    @InjectRepository(GroceryItem)
    private readonly repo: Repository<GroceryItem>,
    private readonly cacheService: GroceryCacheService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateGroceryDto, ctx: RequestContext): Promise<GroceryItem> {
    const item = await this.repo.save(this.repo.create(dto));

    setImmediate(() => void this.cacheService.invalidateAll());

    setImmediate(() => void this.cacheService.setStockCounter(item.id, item.stock));

    void this.auditService.log({
      ...ctx,
      action: AuditAction.GROCERY_CREATED,
      entity: 'GroceryItem',
      entityId: item.id,
      status: 'SUCCESS',
      afterData: { id: item.id, name: item.name, description: item.description, price: item.price, stock: item.stock },
    });

    return item;
  }
}
