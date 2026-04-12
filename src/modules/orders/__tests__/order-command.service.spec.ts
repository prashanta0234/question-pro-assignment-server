import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { OrderCommandService } from '../services/order-command.service';
import { GroceryCacheService } from '../../groceries/services/grocery-cache.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { GroceryItem } from '../../groceries/entities/grocery-item.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { QUEUE_INVENTORY, QUEUE_ORDER } from '../../../queues/constants/queue-names.const';
import { mockAuditService } from '../../../test/mocks/repository.mock';
import { buildRequestCtx } from '../../../test/factories/request-context.factory';
import { Role } from '../../users/enums/role.enum';

// ── Factories ──────────────────────────────────────────────────────────────

const buildGroceryItem = (overrides = {}): GroceryItem =>
  Object.assign(new GroceryItem(), {
    id: crypto.randomUUID(),
    name: 'Milk',
    price: 2.99,
    stock: 20,
    lowStockNotified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

const buildOrder = (overrides = {}): Order =>
  Object.assign(new Order(), {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    status: OrderStatus.CONFIRMED,
    totalAmount: 9.99,
    idempotencyKey: null,
    orderItems: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockCacheService = () => ({
  getIdempotencyResponse: jest.fn().mockResolvedValue(null),
  setIdempotencyResponse: jest.fn().mockResolvedValue(undefined),
  atomicDecrementStock: jest.fn().mockResolvedValue(10), // plenty of stock
  atomicIncrementStock: jest.fn().mockResolvedValue(10),
  invalidateAll: jest.fn().mockResolvedValue(undefined),
});

const mockQueue = () => ({
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
});

// Shared mock entity manager
const buildMockManager = (items: GroceryItem[]) => ({
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(items),
  }),
  create: jest.fn((EntityClass, data) => Object.assign(
    EntityClass === OrderItem ? new OrderItem() : new Order(),
    data,
  )),
  save: jest.fn().mockImplementation((EntityClass, data) => Promise.resolve(
    Object.assign(EntityClass === Order ? new Order() : new OrderItem(), data, { id: crypto.randomUUID() }),
  )),
  decrement: jest.fn().mockResolvedValue(undefined),
});

describe('OrderCommandService', () => {
  let service: OrderCommandService;
  let cache: ReturnType<typeof mockCacheService>;
  let audit: ReturnType<typeof mockAuditService>;
  let orderQueue: ReturnType<typeof mockQueue>;
  let inventoryQueue: ReturnType<typeof mockQueue>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;

  const userId = crypto.randomUUID();
  const ctx = buildRequestCtx({ userRole: Role.USER });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderCommandService,
        { provide: GroceryCacheService, useFactory: mockCacheService },
        { provide: AuditService, useFactory: mockAuditService },
        { provide: getQueueToken(QUEUE_ORDER), useFactory: mockQueue },
        { provide: getQueueToken(QUEUE_INVENTORY), useFactory: mockQueue },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(OrderCommandService);
    cache = module.get(GroceryCacheService);
    audit = module.get(AuditService);
    orderQueue = module.get(getQueueToken(QUEUE_ORDER));
    inventoryQueue = module.get(getQueueToken(QUEUE_INVENTORY));
    dataSource = module.get(DataSource);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Idempotency ────────────────────────────────────────────────────────────

  describe('idempotency fast path', () => {
    it('should return cached response and skip transaction on duplicate key', async () => {
      const existing = buildOrder();
      cache.getIdempotencyResponse.mockResolvedValue(existing);

      const result = await service.createOrder(
        userId,
        { items: [{ groceryItemId: crypto.randomUUID(), quantity: 1 }] },
        ctx,
        'idempotency-key-001',
      );

      expect(result).toEqual(existing);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should proceed normally when idempotency key is new', async () => {
      cache.getIdempotencyResponse.mockResolvedValue(null);
      const item = buildGroceryItem();
      const manager = buildMockManager([item]);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await service.createOrder(userId, { items: [{ groceryItemId: item.id, quantity: 1 }] }, ctx, 'new-key');

      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });

  // ── Layer 1: Redis pre-check ───────────────────────────────────────────────

  describe('Redis pre-check (Layer 1)', () => {
    it('should reject immediately when stock counter goes negative — no transaction', async () => {
      cache.atomicDecrementStock.mockResolvedValue(-5); // negative = exhausted

      await expect(
        service.createOrder(userId, { items: [{ groceryItemId: crypto.randomUUID(), quantity: 10 }] }, ctx),
      ).rejects.toThrow(ConflictException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should rollback Redis counters when pre-check fails', async () => {
      cache.atomicDecrementStock.mockResolvedValue(-3);

      await expect(
        service.createOrder(userId, { items: [{ groceryItemId: 'item-1', quantity: 5 }] }, ctx),
      ).rejects.toThrow(ConflictException);

      expect(cache.atomicIncrementStock).toHaveBeenCalled();
    });

    it('should skip Layer 1 and go to DB when counter returns -1 (cache miss)', async () => {
      cache.atomicDecrementStock.mockResolvedValue(-1); // cache miss signal
      const item = buildGroceryItem({ stock: 20 });
      const manager = buildMockManager([item]);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await service.createOrder(userId, { items: [{ groceryItemId: item.id, quantity: 2 }] }, ctx);

      expect(dataSource.transaction).toHaveBeenCalled(); // fell through to DB
    });
  });

  // ── Layer 2: DB transaction (SELECT FOR UPDATE) ────────────────────────────

  describe('DB transaction (Layer 2)', () => {
    it('should acquire locks in ascending ID order to prevent deadlocks', async () => {
      const ids = ['zzz-id', 'aaa-id', 'mmm-id'];
      const items = ids.map((id) => buildGroceryItem({ id, stock: 10 }));
      const manager = buildMockManager(items);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await service.createOrder(
        userId,
        { items: ids.map((id) => ({ groceryItemId: id, quantity: 1 })) },
        ctx,
      );

      const qb = manager.createQueryBuilder();
      expect(qb.orderBy).toHaveBeenCalledWith('item.id', 'ASC');
      expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
    });

    it('should throw NotFoundException when one or more items are not found', async () => {
      const manager = buildMockManager([]); // no items found
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await expect(
        service.createOrder(userId, { items: [{ groceryItemId: 'bad-id', quantity: 1 }] }, ctx),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException with INSUFFICIENT_STOCK when DB stock is too low', async () => {
      const item = buildGroceryItem({ stock: 1 });
      const manager = buildMockManager([item]);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await expect(
        service.createOrder(userId, { items: [{ groceryItemId: item.id, quantity: 5 }] }, ctx),
      ).rejects.toThrow(ConflictException);
    });

    it('should decrement stock for each item inside the transaction', async () => {
      const item = buildGroceryItem({ stock: 10 });
      const manager = buildMockManager([item]);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await service.createOrder(userId, { items: [{ groceryItemId: item.id, quantity: 3 }] }, ctx);

      expect(manager.decrement).toHaveBeenCalledWith(GroceryItem, { id: item.id }, 'stock', 3);
    });
  });

  // ── Price snapshot & total calculation ────────────────────────────────────

  describe('price snapshot and total', () => {
    it('should snapshot unitPrice from DB at order time (not from client)', async () => {
      const item = buildGroceryItem({ price: 5.99, stock: 10 });
      const manager = buildMockManager([item]);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await service.createOrder(userId, { items: [{ groceryItemId: item.id, quantity: 2 }] }, ctx);

      expect(manager.create).toHaveBeenCalledWith(
        OrderItem,
        expect.objectContaining({ unitPrice: 5.99 }),
      );
    });

    it('should calculate totalAmount server-side (quantity * unitPrice)', async () => {
      const item = buildGroceryItem({ price: 4.00, stock: 10 });
      const manager = buildMockManager([item]);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await service.createOrder(userId, { items: [{ groceryItemId: item.id, quantity: 3 }] }, ctx);

      expect(manager.create).toHaveBeenCalledWith(
        Order,
        expect.objectContaining({ totalAmount: 12.00 }),
      );
    });

    it('should set subtotal = quantity * unitPrice on each order item', async () => {
      const item = buildGroceryItem({ price: 2.50, stock: 10 });
      const manager = buildMockManager([item]);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await service.createOrder(userId, { items: [{ groceryItemId: item.id, quantity: 4 }] }, ctx);

      expect(manager.create).toHaveBeenCalledWith(
        OrderItem,
        expect.objectContaining({ subtotal: 10.00 }),
      );
    });
  });

  // ── Duplicate item merging ─────────────────────────────────────────────────

  describe('duplicate item merging', () => {
    it('should merge duplicate groceryItemIds and sum quantities', async () => {
      const item = buildGroceryItem({ stock: 20 });
      const manager = buildMockManager([item]);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await service.createOrder(userId, {
        items: [
          { groceryItemId: item.id, quantity: 2 },
          { groceryItemId: item.id, quantity: 3 }, // duplicate
        ],
      }, ctx);

      // Decrement should be called once with merged quantity 5
      expect(manager.decrement).toHaveBeenCalledTimes(1);
      expect(manager.decrement).toHaveBeenCalledWith(GroceryItem, { id: item.id }, 'stock', 5);
    });
  });

  // ── Error handling & audit ─────────────────────────────────────────────────

  describe('error handling', () => {
    it('should rollback Redis counters and log ORDER_PLACE_FAILED on transaction error', async () => {
      cache.atomicDecrementStock.mockResolvedValue(5);
      (dataSource.transaction as jest.Mock).mockRejectedValue(new Error('DB timeout'));

      await expect(
        service.createOrder(userId, { items: [{ groceryItemId: 'item-1', quantity: 1 }] }, ctx),
      ).rejects.toThrow('DB timeout');

      expect(cache.atomicIncrementStock).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_PLACE_FAILED,
          status: 'FAILURE',
        }),
      );
    });
  });

  // ── Post-commit side effects ───────────────────────────────────────────────

  describe('post-commit side effects', () => {
    it('should enqueue SEND_ORDER_CONFIRMATION with retry settings', async () => {
      const item = buildGroceryItem({ stock: 10 });
      const manager = buildMockManager([item]);
      const order = buildOrder({ userId });
      manager.save.mockResolvedValue(order);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await service.createOrder(userId, { items: [{ groceryItemId: item.id, quantity: 1 }] }, ctx);
      await new Promise((r) => setImmediate(r));

      expect(orderQueue.add).toHaveBeenCalledWith(
        'SEND_ORDER_CONFIRMATION',
        expect.objectContaining({ userId }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('should enqueue CHECK_LOW_STOCK with deduplicated jobId per item', async () => {
      const item = buildGroceryItem({ stock: 10 });
      const manager = buildMockManager([item]);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await service.createOrder(userId, { items: [{ groceryItemId: item.id, quantity: 1 }] }, ctx);
      await new Promise((r) => setImmediate(r));

      expect(inventoryQueue.add).toHaveBeenCalledWith(
        'CHECK_LOW_STOCK',
        expect.objectContaining({ itemId: item.id }),
        expect.objectContaining({ jobId: `low-stock-${item.id}` }),
      );
    });

    it('should cache idempotency response after successful order', async () => {
      const item = buildGroceryItem({ stock: 10 });
      const manager = buildMockManager([item]);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      const key = 'my-idempotency-key';
      await service.createOrder(userId, { items: [{ groceryItemId: item.id, quantity: 1 }] }, ctx, key);

      expect(cache.setIdempotencyResponse).toHaveBeenCalledWith(
        userId,
        key,
        expect.any(Object),
      );
    });

    it('should log ORDER_PLACED audit with SUCCESS on commit', async () => {
      const item = buildGroceryItem({ stock: 10 });
      const manager = buildMockManager([item]);
      (dataSource.transaction as jest.Mock).mockImplementation((fn: (m: typeof manager) => Promise<Order>) => fn(manager));

      await service.createOrder(userId, { items: [{ groceryItemId: item.id, quantity: 1 }] }, ctx);

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_PLACED,
          status: 'SUCCESS',
          userId,
        }),
      );
    });
  });
});
