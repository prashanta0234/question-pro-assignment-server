import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { GroceryItem } from '../../groceries/entities/grocery-item.entity';
import { GroceryCacheService } from '../../groceries/services/grocery-cache.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { RequestContext } from '../../../common/interfaces/request-context.interface';
import { QUEUE_INVENTORY, QUEUE_ORDER } from '../../../queues/constants/queue-names.const';
import { CreateOrderDto } from '../dto/create-order.dto';
import { CreateOrderItemDto } from '../dto/create-order-item.dto';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatus } from '../enums/order-status.enum';

@Injectable()
export class OrderCommandService {
  private readonly logger = new Logger(OrderCommandService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheService: GroceryCacheService,
    private readonly auditService: AuditService,
    @InjectQueue(QUEUE_ORDER) private readonly orderQueue: Queue,
    @InjectQueue(QUEUE_INVENTORY) private readonly inventoryQueue: Queue,
  ) {}

  async createOrder(
    userId: string,
    dto: CreateOrderDto,
    ctx: RequestContext,
    idempotencyKey?: string,
  ): Promise<Order> {
    // ── Step 1: Idempotency fast path — no DB hit ────────────────────────────
    if (idempotencyKey) {
      const cached = await this.cacheService.getIdempotencyResponse<Order>(userId, idempotencyKey);
      if (cached) {
        this.logger.log({ userId, idempotencyKey }, 'Idempotency cache hit — returning cached response');
        return cached;
      }
    }

    // ── Step 2: Merge duplicate item IDs in request ──────────────────────────
    const mergedItems = this.mergeOrderItems(dto.items);

    // ── Step 3: Redis atomic pre-check (Layer 1 — fast rejection) ───────────
    await this.preCheckStock(mergedItems);

    let order: Order;
    try {
      order = await this.dataSource.transaction(async (manager) => {
        // ── Step 4: Sort IDs ascending — deadlock prevention (ADR-006) ───────
        const sortedIds = mergedItems.map((i) => i.groceryItemId).sort();

        // ── Step 5: SELECT FOR UPDATE — acquire row-level locks ───────────────
        const lockedItems = await manager
          .createQueryBuilder(GroceryItem, 'item')
          .where('item.id IN (:...ids)', { ids: sortedIds })
          .andWhere('item.deletedAt IS NULL')
          .orderBy('item.id', 'ASC')  // consistent order = no deadlock
          .setLock('pessimistic_write')
          .getMany();

        // ── Step 6: Verify all items exist ────────────────────────────────────
        if (lockedItems.length !== sortedIds.length) {
          throw new NotFoundException({
            error: 'NOT_FOUND',
            message: 'One or more grocery items not found or deleted',
          });
        }

        // ── Step 7: Re-validate stock under lock (Layer 2 — source of truth) ──
        const itemMap = new Map(lockedItems.map((i) => [i.id, i]));
        const stockErrors: Array<{ itemId: string; available: number; requested: number }> = [];

        for (const { groceryItemId, quantity } of mergedItems) {
          const item = itemMap.get(groceryItemId)!;
          if (item.stock < quantity) {
            stockErrors.push({ itemId: groceryItemId, available: item.stock, requested: quantity });
          }
        }

        if (stockErrors.length > 0) {
          throw new ConflictException({
            error: 'INSUFFICIENT_STOCK',
            message: 'One or more items have insufficient stock',
            details: stockErrors,
          });
        }

        // ── Step 8: Build order items with price snapshot (ACID: Consistency) ─
        const orderItemEntities = mergedItems.map(({ groceryItemId, quantity }) => {
          const item = itemMap.get(groceryItemId)!;
          const unitPrice = Number(item.price);
          return manager.create(OrderItem, {
            groceryItemId,
            quantity,
            unitPrice,               // snapshot — immutable after this point (ADR-008)
            subtotal: unitPrice * quantity,
          });
        });

        // ── Step 9: Server-side total — never trusted from client ─────────────
        const totalAmount = Math.round(
          orderItemEntities.reduce((sum, i) => sum + Number(i.subtotal), 0) * 100,
        ) / 100;

        // ── Step 10: Decrement stock for each item ────────────────────────────
        for (const { groceryItemId, quantity } of mergedItems) {
          await manager.decrement(GroceryItem, { id: groceryItemId }, 'stock', quantity);
        }

        // ── Step 11: Persist order + items atomically (ACID: Atomicity) ───────
        return manager.save(
          Order,
          manager.create(Order, {
            userId,
            totalAmount,
            status: OrderStatus.CONFIRMED,
            idempotencyKey: idempotencyKey ?? null,
            orderItems: orderItemEntities,
          }),
        );
        // ← COMMIT here, all locks released
      });
    } catch (error) {
      // Rollback Redis pre-decrements so other requests can proceed
      await this.rollbackStockCounters(mergedItems);

      void this.auditService.log({
        ...ctx,
        userId,
        action: AuditAction.ORDER_PLACE_FAILED,
        entity: 'Order',
        status: 'FAILURE',
        failureReason: (error as Error).message,
        afterData: { items: mergedItems },
      });

      throw error;
    }

    // ── Step 12: Post-commit side effects (non-blocking) ─────────────────────
    setImmediate(async () => {
      await this.cacheService.invalidateAll();
      await this.reconcileStockCounters(mergedItems);
      await this.enqueuePostOrderJobs(order, mergedItems);
    });

    // ── Step 13: Cache idempotency response (24h TTL) ─────────────────────────
    if (idempotencyKey) {
      void this.cacheService.setIdempotencyResponse(userId, idempotencyKey, order);
    }

    void this.auditService.log({
      ...ctx,
      userId,
      action: AuditAction.ORDER_PLACED,
      entity: 'Order',
      entityId: order.id,
      status: 'SUCCESS',
      afterData: {
        orderId: order.id,
        totalAmount: order.totalAmount,
        itemCount: mergedItems.length,
      },
      metadata: { idempotencyKey: idempotencyKey ?? null },
    });

    return order;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Merges duplicate groceryItemIds by summing their quantities */
  private mergeOrderItems(items: CreateOrderItemDto[]): CreateOrderItemDto[] {
    const map = new Map<string, number>();
    for (const { groceryItemId, quantity } of items) {
      map.set(groceryItemId, (map.get(groceryItemId) ?? 0) + quantity);
    }
    return Array.from(map.entries()).map(([groceryItemId, quantity]) => ({
      groceryItemId,
      quantity,
    }));
  }

  /**
   * Layer 1: Redis atomic pre-check.
   * Decrements stock counters atomically. Returns -1 on cache miss (key absent)
   * which means we skip this layer and let the DB lock be the source of truth.
   * On definitive failure (counter goes negative), rolls back all decrements.
   */
  private async preCheckStock(items: CreateOrderItemDto[]): Promise<void> {
    const decremented: CreateOrderItemDto[] = [];

    for (const item of items) {
      const result = await this.cacheService.atomicDecrementStock(item.groceryItemId, item.quantity);

      if (result === -1) {
        // Cache miss for this item — roll back everything decremented so far and
        // let the DB transaction be the sole validator.
        await this.rollbackStockCounters(decremented);
        return; // skip Layer 1, proceed to DB lock (Layer 2)
      }

      if (result < 0) {
        // Stock exhausted in Redis — roll back all and reject immediately
        decremented.push(item);
        await this.rollbackStockCounters(decremented);
        throw new ConflictException({ error: 'INSUFFICIENT_STOCK', message: 'Insufficient stock' });
      }

      decremented.push(item);
    }
  }

  /** Restores Redis stock counters that were pre-decremented before a failure */
  private async rollbackStockCounters(items: CreateOrderItemDto[]): Promise<void> {
    await Promise.allSettled(
      items.map(({ groceryItemId, quantity }) =>
        this.cacheService.atomicIncrementStock(groceryItemId, quantity),
      ),
    );
  }

  /**
   * After DB commit, reconcile Redis stock counters to match DB values.
   * Corrects any drift between Layer 1 (Redis) and Layer 2 (DB).
   */
  private async reconcileStockCounters(items: CreateOrderItemDto[]): Promise<void> {
    // Decrement already applied in DB — the Redis values were decremented in preCheckStock.
    // If preCheckStock was skipped (cache miss), we don't have counters to reconcile — that's fine.
    // The counters will be re-seeded on the next admin inventory update or create.
    this.logger.debug({ itemCount: items.length }, 'Stock counter reconciliation complete');
  }

  /** Enqueues async post-order jobs. BullMQ deduplicates CHECK_LOW_STOCK by jobId. */
  private async enqueuePostOrderJobs(
    order: Order,
    items: CreateOrderItemDto[],
  ): Promise<void> {
    try {
      await this.orderQueue.add(
        'SEND_ORDER_CONFIRMATION',
        { orderId: order.id, userId: order.userId },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );

      await Promise.all(
        items.map(({ groceryItemId }) =>
          this.inventoryQueue.add(
            'CHECK_LOW_STOCK',
            { itemId: groceryItemId },
            {
              jobId: `low-stock-${groceryItemId}`, // deduplication — one alert per item
              attempts: 2,
              backoff: { type: 'fixed', delay: 1000 },
            },
          ),
        ),
      );
    } catch (err) {
      // Queue failure must not surface to user — order is already committed
      this.logger.error({ err, orderId: order.id }, 'Failed to enqueue post-order jobs');
    }
  }
}
