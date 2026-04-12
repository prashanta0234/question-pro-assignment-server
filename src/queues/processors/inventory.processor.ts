import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { IsNull, Repository } from 'typeorm';
import { GroceryItem } from '../../modules/groceries/entities/grocery-item.entity';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction } from '../../modules/audit/enums/audit-action.enum';
import { ConfigService } from '@nestjs/config';
import { QUEUE_INVENTORY } from '../constants/queue-names.const';

interface LowStockPayload {
  itemId: string;
}

@Processor(QUEUE_INVENTORY)
@Injectable()
export class InventoryProcessor extends WorkerHost {
  private readonly logger = new Logger(InventoryProcessor.name);
  private readonly threshold: number;

  constructor(
    @InjectRepository(GroceryItem)
    private readonly groceryRepo: Repository<GroceryItem>,
    private readonly auditService: AuditService,
    configService: ConfigService,
  ) {
    super();
    this.threshold = configService.get<number>('business.lowStockThreshold') ?? 10;
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'CHECK_LOW_STOCK') {
      await this.handleLowStockCheck(job as Job<LowStockPayload>);
    }
  }

  private async handleLowStockCheck(job: Job<LowStockPayload>): Promise<void> {
    const { itemId } = job.data;

    const item = await this.groceryRepo.findOne({
      where: { id: itemId, deletedAt: IsNull() },
    });

    // Guard: item deleted, stock above threshold, or already notified (no spam)
    if (!item || item.stock >= this.threshold || item.lowStockNotified) return;

    this.logger.warn(
      { itemId: item.id, itemName: item.name, stock: item.stock, threshold: this.threshold },
      'LOW_STOCK_ALERT',
    );

    await this.groceryRepo.update(item.id, { lowStockNotified: true });

    void this.auditService.log({
      action: AuditAction.LOW_STOCK_ALERT,
      entity: 'GroceryItem',
      entityId: item.id,
      status: 'SUCCESS',
      userRole: 'SYSTEM',
      afterData: { stock: item.stock, threshold: this.threshold },
      ipAddress: '0.0.0.0',
      requestId: `job:${job.id ?? 'unknown'}`,
    });
  }
}
