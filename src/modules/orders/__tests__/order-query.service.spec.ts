import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrderQueryService } from '../services/order-query.service';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { mockRepository } from '../../../test/mocks/repository.mock';
import { buildPaginatedResult } from '../../../common/helpers/pagination.helper';
import { OrderQueryDto } from '../dto/order-query.dto';

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

const defaultQuery: OrderQueryDto = { page: 1, limit: 20 };

describe('OrderQueryService', () => {
  let service: OrderQueryService;
  let repo: ReturnType<typeof mockRepository>;

  const userId = crypto.randomUUID();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderQueryService,
        { provide: getRepositoryToken(Order), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get(OrderQueryService);
    repo = module.get(getRepositoryToken(Order));
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAllByUser()', () => {
    it('should return paginated orders for the authenticated user', async () => {
      const orders = [buildOrder({ userId }), buildOrder({ userId })];
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([orders, 2]);

      const result = await service.findAllByUser(userId, defaultQuery);

      expect(result.data).toEqual(orders);
      expect(result.meta.total).toBe(2);
    });

    it('should scope the query by userId', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAllByUser(userId, defaultQuery);

      expect(qb.where).toHaveBeenCalledWith('order.userId = :userId', { userId });
    });

    it('should default to sorting by createdAt DESC', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAllByUser(userId, defaultQuery);

      expect(qb.orderBy).toHaveBeenCalledWith('order.createdAt', 'DESC');
    });

    it('should respect custom sortBy and sortOrder', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAllByUser(userId, { ...defaultQuery, sortBy: 'totalAmount', sortOrder: 'ASC' });

      expect(qb.orderBy).toHaveBeenCalledWith('order.totalAmount', 'ASC');
    });

    it('should return correct pagination meta', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([Array(10).fill(buildOrder()), 45]);

      const result = await service.findAllByUser(userId, { page: 2, limit: 10 });

      expect(result.meta.total).toBe(45);
      expect(result.meta.totalPages).toBe(5);
      expect(result.meta.hasPrevPage).toBe(true);
      expect(result.meta.hasNextPage).toBe(true);
    });

    it('should apply correct skip and take for pagination', async () => {
      const qb = repo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAllByUser(userId, { page: 3, limit: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20); // (3-1) * 10
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });

  describe('findOneByUser()', () => {
    it('should return the order when it belongs to the user', async () => {
      const order = buildOrder({ userId });
      repo.findOne.mockResolvedValue(order);

      const result = await service.findOneByUser(order.id, userId);

      expect(result).toEqual(order);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: order.id, userId } }),
      );
    });

    it('should throw NotFoundException when order not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOneByUser('bad-id', userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when order belongs to a different user (ownership)', async () => {
      // Different userId — findOne returns null because WHERE userId doesn't match
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOneByUser('order-id', 'different-user-id')).rejects.toThrow(NotFoundException);
    });

    it('should include NOT_FOUND error code in exception', async () => {
      repo.findOne.mockResolvedValue(null);

      try {
        await service.findOneByUser('bad-id', userId);
      } catch (err) {
        const response = (err as NotFoundException).getResponse() as Record<string, unknown>;
        expect(response.error).toBe('NOT_FOUND');
      }
    });

    it('should eager-load orderItems and their groceryItem relation', async () => {
      const order = buildOrder({ userId });
      repo.findOne.mockResolvedValue(order);

      await service.findOneByUser(order.id, userId);

      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['orderItems', 'orderItems.groceryItem'],
        }),
      );
    });
  });
});
