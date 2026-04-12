import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroceryCreateService } from '../services/grocery-create.service';
import { GroceryCacheService } from '../services/grocery-cache.service';
import { GroceryItem } from '../entities/grocery-item.entity';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { CreateGroceryDto } from '../dto/create-grocery.dto';
import { mockRepository, mockAuditService } from '../../../test/mocks/repository.mock';
import { buildRequestCtx } from '../../../test/factories/request-context.factory';
import { Role } from '../../users/enums/role.enum';

const mockCacheService = () => ({
  invalidateAll: jest.fn().mockResolvedValue(undefined),
  setStockCounter: jest.fn().mockResolvedValue(undefined),
});

const buildItem = (overrides = {}): GroceryItem =>
  Object.assign(new GroceryItem(), {
    id: crypto.randomUUID(),
    name: 'Eggs',
    price: 3.99,
    stock: 50,
    lowStockNotified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

describe('GroceryCreateService', () => {
  let service: GroceryCreateService;
  let repo: ReturnType<typeof mockRepository>;
  let cache: ReturnType<typeof mockCacheService>;
  let audit: ReturnType<typeof mockAuditService>;

  const ctx = buildRequestCtx({ userRole: Role.ADMIN });
  const dto: CreateGroceryDto = { name: 'Eggs', price: 3.99, stock: 50 };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroceryCreateService,
        { provide: getRepositoryToken(GroceryItem), useFactory: mockRepository },
        { provide: GroceryCacheService, useFactory: mockCacheService },
        { provide: AuditService, useFactory: mockAuditService },
      ],
    }).compile();

    service = module.get(GroceryCreateService);
    repo = module.get(getRepositoryToken(GroceryItem));
    cache = module.get(GroceryCacheService);
    audit = module.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should save and return the created item', async () => {
    const item = buildItem(dto);
    repo.create.mockReturnValue(item);
    repo.save.mockResolvedValue(item);

    const result = await service.create(dto, ctx);

    expect(repo.create).toHaveBeenCalledWith(dto);
    expect(repo.save).toHaveBeenCalledWith(item);
    expect(result).toEqual(item);
  });

  it('should log GROCERY_CREATED audit on success', async () => {
    const item = buildItem(dto);
    repo.create.mockReturnValue(item);
    repo.save.mockResolvedValue(item);

    await service.create(dto, ctx);
    await new Promise((r) => setImmediate(r));

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.GROCERY_CREATED,
        entity: 'GroceryItem',
        entityId: item.id,
        status: 'SUCCESS',
      }),
    );
  });

  it('should invalidate cache after creation (via setImmediate)', async () => {
    const item = buildItem(dto);
    repo.create.mockReturnValue(item);
    repo.save.mockResolvedValue(item);

    await service.create(dto, ctx);
    await new Promise((r) => setImmediate(r));

    expect(cache.invalidateAll).toHaveBeenCalled();
  });

  it('should seed Redis stock counter after creation', async () => {
    const item = buildItem({ stock: 50 });
    repo.create.mockReturnValue(item);
    repo.save.mockResolvedValue(item);

    await service.create(dto, ctx);
    await new Promise((r) => setImmediate(r));

    expect(cache.setStockCounter).toHaveBeenCalledWith(item.id, item.stock);
  });

  it('should propagate DB errors', async () => {
    repo.create.mockReturnValue(buildItem());
    repo.save.mockRejectedValue(new Error('DB constraint violation'));

    await expect(service.create(dto, ctx)).rejects.toThrow('DB constraint violation');
  });
});
