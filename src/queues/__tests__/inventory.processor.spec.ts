import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { InventoryProcessor } from '../processors/inventory.processor';
import { GroceryItem } from '../../modules/groceries/entities/grocery-item.entity';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction } from '../../modules/audit/enums/audit-action.enum';
import { mockRepository, mockAuditService } from '../../test/mocks/repository.mock';

const buildItem = (overrides = {}): GroceryItem =>
  Object.assign(new GroceryItem(), {
    id: crypto.randomUUID(),
    name: 'Low Stock Item',
    price: 1.99,
    stock: 3,
    lowStockNotified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

const buildJob = (data: { itemId: string }): Partial<Job> => ({
  id: 'job-1',
  name: 'CHECK_LOW_STOCK',
  data,
});

describe('InventoryProcessor', () => {
  let processor: InventoryProcessor;
  let repo: ReturnType<typeof mockRepository>;
  let audit: ReturnType<typeof mockAuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryProcessor,
        { provide: getRepositoryToken(GroceryItem), useFactory: mockRepository },
        { provide: AuditService, useFactory: mockAuditService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(10) }, // threshold = 10
        },
      ],
    }).compile();

    processor = module.get(InventoryProcessor);
    repo = module.get(getRepositoryToken(GroceryItem));
    audit = module.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('handleLowStockCheck()', () => {
    it('should set lowStockNotified = true and log LOW_STOCK_ALERT when stock below threshold', async () => {
      const item = buildItem({ stock: 3, lowStockNotified: false });
      repo.findOne.mockResolvedValue(item);

      await processor.process(buildJob({ itemId: item.id }) as Job);

      expect(repo.update).toHaveBeenCalledWith(item.id, { lowStockNotified: true });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOW_STOCK_ALERT,
          entityId: item.id,
          status: 'SUCCESS',
          userRole: 'SYSTEM',
          afterData: expect.objectContaining({ stock: 3, threshold: 10 }),
        }),
      );
    });

    it('should NOT alert when lowStockNotified is already true — prevents spam', async () => {
      const item = buildItem({ stock: 3, lowStockNotified: true });
      repo.findOne.mockResolvedValue(item);

      await processor.process(buildJob({ itemId: item.id }) as Job);

      expect(repo.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('should NOT alert when stock is at or above threshold', async () => {
      const item = buildItem({ stock: 10, lowStockNotified: false }); // exactly at threshold
      repo.findOne.mockResolvedValue(item);

      await processor.process(buildJob({ itemId: item.id }) as Job);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should NOT alert for soft-deleted items (findOne returns null)', async () => {
      repo.findOne.mockResolvedValue(null);

      await processor.process(buildJob({ itemId: 'deleted-id' }) as Job);

      expect(repo.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('should alert when stock is exactly one below threshold (boundary)', async () => {
      const item = buildItem({ stock: 9, lowStockNotified: false }); // 9 < 10
      repo.findOne.mockResolvedValue(item);

      await processor.process(buildJob({ itemId: item.id }) as Job);

      expect(repo.update).toHaveBeenCalledWith(item.id, { lowStockNotified: true });
    });
  });
});
