import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroceryReadService } from '../services/grocery-read.service';
import { GroceryCacheService } from '../services/grocery-cache.service';
import { GroceryItem } from '../entities/grocery-item.entity';
import { GroceryQueryDto } from '../dto/grocery-query.dto';
import { mockRepository } from '../../../test/mocks/repository.mock';
import { buildPaginatedResult } from '../../../common/helpers/pagination.helper';

const mockCacheService = () => ({
  getList: jest.fn().mockResolvedValue(null),
  setList: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
});

const buildItem = (overrides: Partial<GroceryItem> = {}): GroceryItem =>
  Object.assign(new GroceryItem(), {
    id: crypto.randomUUID(),
    name: 'Test Milk',
    description: null,
    price: 2.99,
    stock: 50,
    lowStockNotified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

const defaultQuery: GroceryQueryDto = { page: 1, limit: 20 };

describe('GroceryReadService', () => {
  let service: GroceryReadService;
  let repo: ReturnType<typeof mockRepository>;
  let cache: ReturnType<typeof mockCacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroceryReadService,
        { provide: getRepositoryToken(GroceryItem), useFactory: mockRepository },
        { provide: GroceryCacheService, useFactory: mockCacheService },
      ],
    }).compile();

    service = module.get(GroceryReadService);
    repo = module.get(getRepositoryToken(GroceryItem));
    cache = module.get(GroceryCacheService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll()', () => {
    it('should return cached result on cache hit', async () => {
      const cached = buildPaginatedResult([buildItem()], 1, defaultQuery);
      cache.getList.mockResolvedValue(cached);

      const result = await service.findAll(defaultQuery);

      expect(result).toEqual(cached);
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should query DB and cache result on cache miss', async () => {
      const items = [buildItem(), buildItem()];
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([items, 2]);

      const result = await service.findAll(defaultQuery);

      expect(cache.setList).toHaveBeenCalledWith(
        defaultQuery,
        expect.objectContaining({ data: items, meta: expect.objectContaining({ total: 2 }) }),
      );
      expect(result.data).toEqual(items);
    });

    it('should filter by search term using ILIKE', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ ...defaultQuery, search: 'milk' });

      expect(qb.andWhere).toHaveBeenCalledWith('item.name ILIKE :search', { search: '%milk%' });
    });

    it('should exclude soft-deleted items and out-of-stock by default', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(defaultQuery);

      expect(qb.andWhere).toHaveBeenCalledWith('item.deletedAt IS NULL');
      expect(qb.andWhere).toHaveBeenCalledWith('item.stock > 0');
    });

    it('should call withDeleted() when includeDeleted = true', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(defaultQuery, true);

      expect(qb.withDeleted).toHaveBeenCalled();
    });

    it('should NOT write to cache when includeDeleted = true', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(defaultQuery, true);

      expect(cache.setList).not.toHaveBeenCalled();
    });

    it('should return correct pagination meta', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([Array(20).fill(buildItem()), 85]);

      const result = await service.findAll({ page: 2, limit: 20 });

      expect(result.meta.total).toBe(85);
      expect(result.meta.totalPages).toBe(5);
      expect(result.meta.hasPrevPage).toBe(true);
      expect(result.meta.hasNextPage).toBe(true);
    });
  });

  describe('findByIdOrFail()', () => {
    it('should return cached item when cache hit', async () => {
      const item = buildItem();
      cache.getItem.mockResolvedValue(item);

      const result = await service.findByIdOrFail(item.id);

      expect(result).toEqual(item);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('should query DB and cache item on cache miss', async () => {
      const item = buildItem();
      cache.getItem.mockResolvedValue(null);
      repo.findOne.mockResolvedValue(item);

      const result = await service.findByIdOrFail(item.id);

      expect(repo.findOne).toHaveBeenCalled();
      expect(cache.setItem).toHaveBeenCalledWith(item);
      expect(result).toEqual(item);
    });

    it('should throw NotFoundException for non-existent item', async () => {
      cache.getItem.mockResolvedValue(null);
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should include NOT_FOUND error code in exception', async () => {
      cache.getItem.mockResolvedValue(null);
      repo.findOne.mockResolvedValue(null);

      try {
        await service.findByIdOrFail('bad-id');
      } catch (err) {
        const response = (err as NotFoundException).getResponse() as Record<string, unknown>;
        expect(response.error).toBe('NOT_FOUND');
      }
    });
  });

  describe('findByIdOrFailAdmin()', () => {
    it('should return a soft-deleted item (admin can see deleted)', async () => {
      const deletedItem = buildItem({ deletedAt: new Date() });
      repo.findOne.mockResolvedValue(deletedItem);

      const result = await service.findByIdOrFailAdmin(deletedItem.id);

      expect(result).toEqual(deletedItem);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: deletedItem.id }, withDeleted: true }),
      );
    });

    it('should return an active item', async () => {
      const item = buildItem();
      repo.findOne.mockResolvedValue(item);

      const result = await service.findByIdOrFailAdmin(item.id);

      expect(result).toEqual(item);
    });

    it('should throw NotFoundException when item does not exist at all', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFailAdmin('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should NOT read from or write to cache', async () => {
      const item = buildItem();
      repo.findOne.mockResolvedValue(item);

      await service.findByIdOrFailAdmin(item.id);

      expect(cache.getItem).not.toHaveBeenCalled();
      expect(cache.setItem).not.toHaveBeenCalled();
    });
  });
});
