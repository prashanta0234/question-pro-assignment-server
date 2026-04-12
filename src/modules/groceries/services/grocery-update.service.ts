import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroceryItem } from '../entities/grocery-item.entity';
import { UpdateGroceryDto } from '../dto/update-grocery.dto';
import { GroceryReadService } from './grocery-read.service';
import { GroceryCacheService } from './grocery-cache.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { RequestContext } from '../../../common/interfaces/request-context.interface';

@Injectable()
export class GroceryUpdateService {
  constructor(
    @InjectRepository(GroceryItem)
    private readonly repo: Repository<GroceryItem>,
    private readonly readService: GroceryReadService,
    private readonly cacheService: GroceryCacheService,
    private readonly auditService: AuditService,
  ) {}

  async update(id: string, dto: UpdateGroceryDto, ctx: RequestContext): Promise<GroceryItem> {
    const before = await this.readService.findByIdOrFail(id);
    const updated = await this.repo.save({ ...before, ...dto });

    setImmediate(() => void this.cacheService.invalidateAll());

    void this.auditService.log({
      ...ctx,
      action: AuditAction.GROCERY_UPDATED,
      entity: 'GroceryItem',
      entityId: id,
      status: 'SUCCESS',
      beforeData: { name: before.name, price: before.price, description: before.description },
      afterData: { name: updated.name, price: updated.price, description: updated.description },
    });

    return updated;
  }
}
