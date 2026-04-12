import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { GroceryInventoryService } from '../services/grocery-inventory.service';
import { GroceryReadService } from '../services/grocery-read.service';
import { GroceryCacheService } from '../services/grocery-cache.service';
import { GroceryItem } from '../entities/grocery-item.entity';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { mockRepository, mockAuditService } from '../../../test/mocks/repository.mock';
import { buildRequestCtx } from '../../../test/factories/request-context.factory';
import { Role } from '../../users/enums/role.enum';

const mockCacheService = () => ({
  setStockCounter: jest.fn().mockResolvedValue(undefined),
  invalidateAll: jest.fn().mockResolvedValue(undefined),
});

const buildItem = (overrides = {}): GroceryItem =>
  Object.assign(new GroceryItem(), {
    id: crypto.randomUUID(),
    name: 'Milk',
    price: 1.99,
    stock: 5,
    lowStockNotified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

describe('GroceryInventoryService', () => {
  let service: GroceryInventoryService;
  let repo: ReturnType<typeof mockRepository>;
  let readService: jest.Mocked<GroceryReadService>;
  let cache: ReturnType<typeof mockCacheService>;
  let audit: ReturnType<typeof mockAuditService>;

  const ctx = buildRequestCtx({ userRole: Role.ADMIN });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroceryInventoryService,
        { provide: getRepositoryToken(GroceryItem), useFactory: mockRepository },
        { provide: GroceryReadService, useValue: { findByIdOrFail: jest.fn() } },
        { provide: GroceryCacheService, useFactory: mockCacheService },
        { provide: AuditService, useFactory: mockAuditService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(10) }, // threshold = 10
        },
      ],
    }).compile();

    service = module.get(GroceryInventoryService);
    repo = module.get(getRepositoryToken(GroceryItem));
    readService = module.get(GroceryReadService) as jest.Mocked<GroceryReadService>;
    cache = module.get(GroceryCacheService);
    audit = module.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should update stock and return the updated item', async () => {
    const item = buildItem({ stock: 5 });
    const updated = { ...item, stock: 50 };
    readService.findByIdOrFail.mockResolvedValue(item);
    repo.save.mockResolvedValue(updated);

    const result = await service.setStock(item.id, { stock: 50 }, ctx);

    expect(result.stock).toBe(50);
  });

  it('should sync Redis stock counter immediately (not via setImmediate)', async () => {
    const item = buildItem({ stock: 5 });
    readService.findByIdOrFail.mockResolvedValue(item);
    repo.save.mockResolvedValue({ ...item, stock: 50 });

    await service.setStock(item.id, { stock: 50 }, ctx);

    // Redis sync must be awaited (not fire-and-forget) for admin override consistency
    expect(cache.setStockCounter).toHaveBeenCalledWith(item.id, 50);
  });

  it('should reset lowStockNotified when restocked above threshold (10)', async () => {
    const item = buildItem({ stock: 2, lowStockNotified: true });
    readService.findByIdOrFail.mockResolvedValue(item);
    repo.save.mockResolvedValue({ ...item, stock: 50, lowStockNotified: false });

    await service.setStock(item.id, { stock: 50 }, ctx);

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ lowStockNotified: false }),
    );
  });

  it('should NOT reset lowStockNotified when restocked below threshold', async () => {
    const item = buildItem({ stock: 2, lowStockNotified: true });
    readService.findByIdOrFail.mockResolvedValue(item);
    repo.save.mockResolvedValue({ ...item, stock: 5, lowStockNotified: true });

    await service.setStock(item.id, { stock: 5 }, ctx);

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ lowStockNotified: true }),
    );
  });

  it('should log INVENTORY_UPDATED with old and new stock values', async () => {
    const item = buildItem({ stock: 5 });
    readService.findByIdOrFail.mockResolvedValue(item);
    repo.save.mockResolvedValue({ ...item, stock: 100 });

    await service.setStock(item.id, { stock: 100 }, ctx);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.INVENTORY_UPDATED,
        beforeData: { stock: 5 },
        afterData: { stock: 100 },
        status: 'SUCCESS',
      }),
    );
  });

  it('should invalidate list cache after stock update', async () => {
    const item = buildItem({ stock: 5 });
    readService.findByIdOrFail.mockResolvedValue(item);
    repo.save.mockResolvedValue({ ...item, stock: 50 });

    await service.setStock(item.id, { stock: 50 }, ctx);
    await new Promise((r) => setImmediate(r));

    expect(cache.invalidateAll).toHaveBeenCalled();
  });
});
