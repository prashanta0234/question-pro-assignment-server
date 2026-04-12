import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroceryUpdateService } from '../services/grocery-update.service';
import { GroceryReadService } from '../services/grocery-read.service';
import { GroceryCacheService } from '../services/grocery-cache.service';
import { GroceryItem } from '../entities/grocery-item.entity';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { mockRepository, mockAuditService } from '../../../test/mocks/repository.mock';
import { buildRequestCtx } from '../../../test/factories/request-context.factory';
import { Role } from '../../users/enums/role.enum';

const mockCacheService = () => ({
  invalidateAll: jest.fn().mockResolvedValue(undefined),
});

const buildItem = (overrides = {}): GroceryItem =>
  Object.assign(new GroceryItem(), {
    id: crypto.randomUUID(),
    name: 'Old Name',
    description: null,
    price: 1.99,
    stock: 10,
    lowStockNotified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

describe('GroceryUpdateService', () => {
  let service: GroceryUpdateService;
  let repo: ReturnType<typeof mockRepository>;
  let readService: jest.Mocked<GroceryReadService>;
  let cache: ReturnType<typeof mockCacheService>;
  let audit: ReturnType<typeof mockAuditService>;

  const ctx = buildRequestCtx({ userRole: Role.ADMIN });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroceryUpdateService,
        { provide: getRepositoryToken(GroceryItem), useFactory: mockRepository },
        { provide: GroceryReadService, useValue: { findByIdOrFail: jest.fn() } },
        { provide: GroceryCacheService, useFactory: mockCacheService },
        { provide: AuditService, useFactory: mockAuditService },
      ],
    }).compile();

    service = module.get(GroceryUpdateService);
    repo = module.get(getRepositoryToken(GroceryItem));
    readService = module.get(GroceryReadService) as jest.Mocked<GroceryReadService>;
    cache = module.get(GroceryCacheService);
    audit = module.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should update and return the modified item', async () => {
    const before = buildItem({ price: 1.99 });
    const after = { ...before, price: 3.50 };
    readService.findByIdOrFail.mockResolvedValue(before);
    repo.save.mockResolvedValue(after);

    const result = await service.update(before.id, { price: 3.50 }, ctx);

    expect(result.price).toBe(3.50);
  });

  it('should capture before and after state in audit log', async () => {
    const before = buildItem({ name: 'Old Name', price: 1.99 });
    const after = { ...before, name: 'New Name', price: 3.50 };
    readService.findByIdOrFail.mockResolvedValue(before);
    repo.save.mockResolvedValue(after);

    await service.update(before.id, { name: 'New Name', price: 3.50 }, ctx);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.GROCERY_UPDATED,
        beforeData: expect.objectContaining({ name: 'Old Name', price: 1.99 }),
        afterData: expect.objectContaining({ name: 'New Name', price: 3.50 }),
        status: 'SUCCESS',
      }),
    );
  });

  it('should invalidate cache after update', async () => {
    const item = buildItem();
    readService.findByIdOrFail.mockResolvedValue(item);
    repo.save.mockResolvedValue({ ...item, name: 'Updated' });

    await service.update(item.id, { name: 'Updated' }, ctx);
    await new Promise((r) => setImmediate(r));

    expect(cache.invalidateAll).toHaveBeenCalled();
  });

  it('should throw NotFoundException when item does not exist', async () => {
    readService.findByIdOrFail.mockRejectedValue(new NotFoundException());

    await expect(service.update('bad-id', { name: 'X' }, ctx)).rejects.toThrow(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
