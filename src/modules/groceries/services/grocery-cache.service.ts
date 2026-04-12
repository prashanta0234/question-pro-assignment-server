import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { GroceryItem } from '../entities/grocery-item.entity';
import { GroceryQueryDto } from '../dto/grocery-query.dto';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';

const TTL = {
  LIST: 60,
  ITEM: 120,
  IDEMPOTENCY: 86_400,

} as const;

@Injectable()
export class GroceryCacheService {
  private readonly logger = new Logger(GroceryCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}


  private listKey(query: GroceryQueryDto): string {
    const { page, limit, search = '', sortBy = 'name', sortOrder = 'ASC' } = query;
    return `groceries:list:${page}:${limit}:${search}:${sortBy}:${sortOrder}`;
  }

  private itemKey(id: string): string {
    return `grocery:item:${id}`;
  }

  private stockKey(id: string): string {
    return `grocery:stock:${id}`;
  }

  private idempotencyKey(userId: string, clientKey: string): string {
    // Scoped per user — prevents cross-user key collision (security.md §8)
    return `idempotency:${userId}:${clientKey}`;
  }


  async getList(query: GroceryQueryDto): Promise<PaginatedResult<GroceryItem> | null> {
    return this.getJson<PaginatedResult<GroceryItem>>(this.listKey(query));
  }

  async setList(query: GroceryQueryDto, result: PaginatedResult<GroceryItem>): Promise<void> {
    await this.setJson(this.listKey(query), result, TTL.LIST);
  }


  async getItem(id: string): Promise<GroceryItem | null> {
    return this.getJson<GroceryItem>(this.itemKey(id));
  }

  async setItem(item: GroceryItem): Promise<void> {
    await this.setJson(this.itemKey(item.id), item, TTL.ITEM);
  }

  async deleteItem(id: string): Promise<void> {
    await this.safeDel(this.itemKey(id));
  }


  async getStockCounter(id: string): Promise<number | null> {
    try {
      const val = await this.redis.get(this.stockKey(id));
      return val !== null ? parseInt(val, 10) : null;
    } catch (err) {
      this.logger.warn({ err, id }, 'Redis stock counter read failed');
      return null;
    }
  }

  async setStockCounter(id: string, stock: number): Promise<void> {
    try {
      await this.redis.set(this.stockKey(id), stock.toString());
    } catch (err) {
      this.logger.warn({ err, id }, 'Redis stock counter write failed');
    }
  }


  async atomicDecrementStock(id: string, by: number): Promise<number> {
    try {
      const key = this.stockKey(id);
      const exists = await this.redis.exists(key);
      if (!exists) return -1;

      return await this.redis.decrby(key, by);
    } catch (err) {
      this.logger.warn({ err, id }, 'Redis atomic decrement failed');
      return -1;
    }
  }

  async atomicIncrementStock(id: string, by: number): Promise<number> {
    try {
      return await this.redis.incrby(this.stockKey(id), by);
    } catch (err) {
      this.logger.warn({ err, id }, 'Redis atomic increment failed');
      return -1;
    }
  }


  async getIdempotencyResponse<T>(userId: string, clientKey: string): Promise<T | null> {
    return this.getJson<T>(this.idempotencyKey(userId, clientKey));
  }

  async setIdempotencyResponse<T>(userId: string, clientKey: string, data: T): Promise<void> {
    await this.setJson(this.idempotencyKey(userId, clientKey), data, TTL.IDEMPOTENCY);
  }

  async invalidateAll(): Promise<void> {
    await Promise.all([
      this.scanAndUnlink('groceries:list:*'),
      this.scanAndUnlink('grocery:item:*'),
    ]);
  }

  private async scanAndUnlink(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.unlink(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn({ err, pattern }, 'Cache invalidation failed — stale cache may persist until TTL');
    }
  }


  private async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn({ err, key }, 'Cache read failed');
      return null;
    }
  }

  private async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      this.logger.warn({ err, key }, 'Cache write failed');
    }
  }

  private async safeDel(key: string): Promise<void> {
    try {
      await this.redis.unlink(key);
    } catch (err) {
      this.logger.warn({ err, key }, 'Cache delete failed');
    }
  }
}
