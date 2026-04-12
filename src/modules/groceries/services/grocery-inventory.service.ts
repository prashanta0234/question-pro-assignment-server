import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { GroceryItem } from '../entities/grocery-item.entity';
import { UpdateInventoryDto } from '../dto/update-inventory.dto';
import { GroceryReadService } from './grocery-read.service';
import { GroceryCacheService } from './grocery-cache.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { RequestContext } from '../../../common/interfaces/request-context.interface';

@Injectable()
export class GroceryInventoryService {
  private readonly lowStockThreshold: number;

  constructor(
    @InjectRepository(GroceryItem)
    private readonly repo: Repository<GroceryItem>,
    private readonly readService: GroceryReadService,
    private readonly cacheService: GroceryCacheService,
    private readonly auditService: AuditService,
    configService: ConfigService,
  ) {
    this.lowStockThreshold = configService.get<number>('business.lowStockThreshold') ?? 10;
  }

  async setStock(id: string, dto: UpdateInventoryDto, ctx: RequestContext): Promise<GroceryItem> {
    const item = await this.readService.findByIdOrFail(id);
    const oldStock = item.stock;

    const shouldResetAlert = dto.stock >= this.lowStockThreshold && item.lowStockNotified;

    const updated = await this.repo.save({
      ...item,
      stock: dto.stock,
      lowStockNotified: shouldResetAlert ? false : item.lowStockNotified,
    });

    await this.cacheService.setStockCounter(id, dto.stock);
    setImmediate(() => void this.cacheService.invalidateAll());

    void this.auditService.log({
      ...ctx,
      action: AuditAction.INVENTORY_UPDATED,
      entity: 'GroceryItem',
      entityId: id,
      status: 'SUCCESS',
      beforeData: { stock: oldStock },
      afterData: { stock: dto.stock },
    });

    return updated;
  }
}
