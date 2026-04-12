import { Test, TestingModule } from '@nestjs/testing';
import { GroceryCacheService } from '../services/grocery-cache.service';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { GroceryItem } from '../entities/grocery-item.entity';
import { GroceryQueryDto } from '../dto/grocery-query.dto';
import { buildPaginatedResult } from '../../../common/helpers/pagination.helper';

const buildItem = (overrides = {}): GroceryItem =>
  Object.assign(new GroceryItem(), {
    id: crypto.randomUUID(),
    name: 'Milk',
    description: 'Fresh milk',
    price: 1.99,
    stock: 10,
    lowStockNotified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

const mockRedis = () => ({
  get: jest.fn().mockResolvedValue(null),
  setex: jest.fn().mockResolvedValue('OK'),
  set: jest.fn().mockResolvedValue('OK'),
  unlink: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(1),
  decrby: jest.fn().mockResolvedValue(5),
  incrby: jest.fn().mockResolvedValue(5),
  scan: jest.fn().mockResolvedValue(['0', []]),
});

const defaultQuery: GroceryQueryDto = { page: 1, limit: 20 };

describe('GroceryCacheService', () => {
  let service: GroceryCacheService;
  let redis: ReturnType<typeof mockRedis>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroceryCacheService,
        { provide: REDIS_CLIENT, useFactory: mockRedis },
      ],
    }).compile();

    service = module.get(GroceryCacheService);
    redis = module.get(REDIS_CLIENT);
  });

  afterEach(() => jest.clearAllMocks());

  // ── List cache ───────────────────────────────────────────────────────────

  describe('getList()', () => {
    it('should return null on cache miss', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.getList(defaultQuery);

      expect(result).toBeNull();
    });

    it('should return parsed result on cache hit', async () => {
      const item = buildItem();
      const paginated = buildPaginatedResult([item], 1, defaultQuery);
      redis.get.mockResolvedValue(JSON.stringify(paginated));

      const result = await service.getList(defaultQuery);

      // JSON round-trip converts Date → string and class instance → plain object
      expect(result).not.toBeNull();
      expect(result!.meta).toEqual(paginated.meta);
      expect(result!.data[0]).toMatchObject({ id: item.id, name: item.name, stock: item.stock });
    });

    it('should return null and not throw on Redis error', async () => {
      redis.get.mockRejectedValue(new Error('Redis down'));

      const result = await service.getList(defaultQuery);

      expect(result).toBeNull();
    });

    it('should build key from all query params including search and sort', async () => {
      await service.getList({ page: 2, limit: 10, search: 'milk', sortBy: 'price', sortOrder: 'DESC' });

      expect(redis.get).toHaveBeenCalledWith('groceries:list:2:10:milk:price:DESC');
    });
  });

  describe('setList()', () => {
    it('should store list as JSON with 60s TTL', async () => {
      const paginated = buildPaginatedResult([buildItem()], 1, defaultQuery);

      await service.setList(defaultQuery, paginated);

      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringContaining('groceries:list:'),
        60,
        JSON.stringify(paginated),
      );
    });

    it('should not throw on Redis write error', async () => {
      redis.setex.mockRejectedValue(new Error('Redis down'));

      await expect(service.setList(defaultQuery, buildPaginatedResult([], 0, defaultQuery))).resolves.not.toThrow();
    });
  });

  // ── Item cache ───────────────────────────────────────────────────────────

  describe('getItem()', () => {
    it('should return null on cache miss', async () => {
      redis.get.mockResolvedValue(null);

      expect(await service.getItem('some-id')).toBeNull();
    });

    it('should return parsed item on cache hit', async () => {
      const item = buildItem();
      redis.get.mockResolvedValue(JSON.stringify(item));

      const result = await service.getItem(item.id);

      // JSON round-trip: Date → string, class instance → plain object
      expect(result).toMatchObject({ id: item.id, name: item.name, stock: item.stock, price: item.price });
    });

    it('should return null and not throw on Redis error', async () => {
      redis.get.mockRejectedValue(new Error('connection reset'));

      expect(await service.getItem('id')).toBeNull();
    });
  });

  describe('setItem()', () => {
    it('should store item as JSON with 120s TTL', async () => {
      const item = buildItem();

      await service.setItem(item);

      expect(redis.setex).toHaveBeenCalledWith(`grocery:item:${item.id}`, 120, JSON.stringify(item));
    });
  });

  describe('deleteItem()', () => {
    it('should unlink the item key', async () => {
      const id = crypto.randomUUID();

      await service.deleteItem(id);

      expect(redis.unlink).toHaveBeenCalledWith(`grocery:item:${id}`);
    });

    it('should not throw on Redis error', async () => {
      redis.unlink.mockRejectedValue(new Error('Redis down'));

      await expect(service.deleteItem('id')).resolves.not.toThrow();
    });
  });

  // ── Stock counter ────────────────────────────────────────────────────────

  describe('setStockCounter()', () => {
    it('should store stock value without TTL', async () => {
      await service.setStockCounter('item-1', 42);

      expect(redis.set).toHaveBeenCalledWith('grocery:stock:item-1', '42');
    });

    it('should not throw on Redis error', async () => {
      redis.set.mockRejectedValue(new Error('Redis down'));

      await expect(service.setStockCounter('id', 10)).resolves.not.toThrow();
    });
  });

  describe('getStockCounter()', () => {
    it('should return parsed integer when key exists', async () => {
      redis.get.mockResolvedValue('15');

      const result = await service.getStockCounter('item-1');

      expect(result).toBe(15);
    });

    it('should return null when key does not exist', async () => {
      redis.get.mockResolvedValue(null);

      expect(await service.getStockCounter('item-1')).toBeNull();
    });

    it('should return null and not throw on Redis error', async () => {
      redis.get.mockRejectedValue(new Error('connection reset'));

      expect(await service.getStockCounter('id')).toBeNull();
    });
  });

  describe('atomicDecrementStock()', () => {
    it('should decrement and return new value when key exists', async () => {
      redis.exists.mockResolvedValue(1);
      redis.decrby.mockResolvedValue(3);

      const result = await service.atomicDecrementStock('item-1', 2);

      expect(redis.decrby).toHaveBeenCalledWith('grocery:stock:item-1', 2);
      expect(result).toBe(3);
    });

    it('should return -1 (cache miss signal) when key does not exist', async () => {
      redis.exists.mockResolvedValue(0);

      const result = await service.atomicDecrementStock('item-1', 2);

      expect(redis.decrby).not.toHaveBeenCalled();
      expect(result).toBe(-1);
    });

    it('should return -1 and not throw on Redis error', async () => {
      redis.exists.mockRejectedValue(new Error('Redis down'));

      const result = await service.atomicDecrementStock('item-1', 1);

      expect(result).toBe(-1);
    });
  });

  describe('atomicIncrementStock()', () => {
    it('should increment and return new value', async () => {
      redis.incrby.mockResolvedValue(8);

      const result = await service.atomicIncrementStock('item-1', 3);

      expect(redis.incrby).toHaveBeenCalledWith('grocery:stock:item-1', 3);
      expect(result).toBe(8);
    });

    it('should return -1 and not throw on Redis error', async () => {
      redis.incrby.mockRejectedValue(new Error('Redis down'));

      const result = await service.atomicIncrementStock('item-1', 1);

      expect(result).toBe(-1);
    });
  });

  // ── Idempotency ──────────────────────────────────────────────────────────

  describe('getIdempotencyResponse()', () => {
    it('should return null when key does not exist', async () => {
      redis.get.mockResolvedValue(null);

      expect(await service.getIdempotencyResponse('user-1', 'key-abc')).toBeNull();
    });

    it('should return parsed response and scope key by userId', async () => {
      const payload = { orderId: 'order-1', totalAmount: 9.99 };
      redis.get.mockResolvedValue(JSON.stringify(payload));

      const result = await service.getIdempotencyResponse<typeof payload>('user-1', 'key-abc');

      expect(redis.get).toHaveBeenCalledWith('idempotency:user-1:key-abc');
      expect(result).toEqual(payload);
    });
  });

  describe('setIdempotencyResponse()', () => {
    it('should store response with 24h TTL and userId-scoped key', async () => {
      const payload = { orderId: 'order-1' };

      await service.setIdempotencyResponse('user-1', 'key-abc', payload);

      expect(redis.setex).toHaveBeenCalledWith(
        'idempotency:user-1:key-abc',
        86400,
        JSON.stringify(payload),
      );
    });
  });

  // ── Invalidation ─────────────────────────────────────────────────────────

  describe('invalidateAll()', () => {
    it('should scan and unlink groceries:list:* and grocery:item:* patterns', async () => {
      redis.scan
        .mockResolvedValueOnce(['0', ['groceries:list:1:20::name:ASC']])
        .mockResolvedValueOnce(['0', ['grocery:item:abc']]);

      await service.invalidateAll();

      expect(redis.unlink).toHaveBeenCalledWith('groceries:list:1:20::name:ASC');
      expect(redis.unlink).toHaveBeenCalledWith('grocery:item:abc');
    });

    it('should continue cursor loop until cursor returns 0', async () => {
      redis.scan
        .mockResolvedValueOnce(['42', ['key-1']])   // first page
        .mockResolvedValueOnce(['0', ['key-2']])    // last page
        .mockResolvedValueOnce(['0', []]);           // item pattern (no results)

      await service.invalidateAll();

      expect(redis.scan).toHaveBeenCalledTimes(3);
    });

    it('should not throw when scan returns no keys', async () => {
      redis.scan.mockResolvedValue(['0', []]);

      await expect(service.invalidateAll()).resolves.not.toThrow();
      expect(redis.unlink).not.toHaveBeenCalled();
    });

    it('should not throw on Redis error — stale cache tolerates failure', async () => {
      redis.scan.mockRejectedValue(new Error('Redis down'));

      await expect(service.invalidateAll()).resolves.not.toThrow();
    });
  });
});
