export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
  atomicDecrement(key: string, by: number): Promise<number>;
  atomicIncrement(key: string, by: number): Promise<number>;
}
