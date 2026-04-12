import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroceryDeleteService } from '../services/grocery-delete.service';
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
  deleteItem: jest.fn().mockResolvedValue(undefined),
});

const buildItem = (overrides = {}): GroceryItem =>
  Object.assign(new GroceryItem(), {
    id: crypto.randomUUID(),
    name: 'To Delete',
    price: 2.99,
    stock: 20,
    lowStockNotified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

describe('GroceryDeleteService', () => {
  let service: GroceryDeleteService;
  let repo: ReturnType<typeof mockRepository>;
  let readService: jest.Mocked<GroceryReadService>;
  let cache: ReturnType<typeof mockCacheService>;
  let audit: ReturnType<typeof mockAuditService>;

  const ctx = buildRequestCtx({ userRole: Role.ADMIN });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroceryDeleteService,
        { provide: getRepositoryToken(GroceryItem), useFactory: mockRepository },
        { provide: GroceryReadService, useValue: { findByIdOrFail: jest.fn() } },
        { provide: GroceryCacheService, useFactory: mockCacheService },
        { provide: AuditService, useFactory: mockAuditService },
      ],
    }).compile();

    service = module.get(GroceryDeleteService);
    repo = module.get(getRepositoryToken(GroceryItem));
    readService = module.get(GroceryReadService) as jest.Mocked<GroceryReadService>;
    cache = module.get(GroceryCacheService);
    audit = module.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should soft-delete and log the action', async () => {
    const item = buildItem();
    readService.findByIdOrFail.mockResolvedValue(item);
    repo.softDelete.mockResolvedValue({ affected: 1 });

    await service.softDelete(item.id, ctx);

    expect(repo.softDelete).toHaveBeenCalledWith(item.id);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.GROCERY_DELETED,
        entityId: item.id,
        status: 'SUCCESS',
        beforeData: expect.objectContaining({ id: item.id, name: item.name }),
      }),
    );
  });

  it('should throw NotFoundException without deleting when item not found', async () => {
    readService.findByIdOrFail.mockRejectedValue(new NotFoundException());

    await expect(service.softDelete('bad-id', ctx)).rejects.toThrow(NotFoundException);
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it('should invalidate cache and delete item cache after soft delete', async () => {
    const item = buildItem();
    readService.findByIdOrFail.mockResolvedValue(item);
    repo.softDelete.mockResolvedValue({ affected: 1 });

    await service.softDelete(item.id, ctx);
    await new Promise((r) => setImmediate(r));

    expect(cache.invalidateAll).toHaveBeenCalled();
    expect(cache.deleteItem).toHaveBeenCalledWith(item.id);
  });
});
