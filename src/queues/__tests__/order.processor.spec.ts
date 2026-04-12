import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderProcessor } from '../processors/order.processor';

const buildJob = (name: string, data: Record<string, unknown>): Partial<Job> => ({
  id: 'job-1',
  name,
  data,
});

describe('OrderProcessor', () => {
  let processor: OrderProcessor;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrderProcessor],
    }).compile();

    processor = module.get(OrderProcessor);

    // Spy on the logger so tests can verify structured log output without noise
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    // Discard any calls made during Nest module initialization
    logSpy.mockClear();
  });

  afterEach(() => jest.clearAllMocks());

  describe('process()', () => {
    it('should handle SEND_ORDER_CONFIRMATION job without throwing', async () => {
      const job = buildJob('SEND_ORDER_CONFIRMATION', {
        orderId: 'order-uuid-1',
        userId: 'user-uuid-1',
      });

      await expect(processor.process(job as Job)).resolves.toBeUndefined();
    });

    it('should log the orderId and userId from the job payload', async () => {
      const orderId = 'order-uuid-2';
      const userId = 'user-uuid-2';
      const job = buildJob('SEND_ORDER_CONFIRMATION', { orderId, userId });

      await processor.process(job as Job);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ orderId, userId }),
        expect.any(String),
      );
    });

    it('should log twice — one for processing start, one for stub confirmation', async () => {
      const job = buildJob('SEND_ORDER_CONFIRMATION', {
        orderId: 'order-uuid-3',
        userId: 'user-uuid-3',
      });

      await processor.process(job as Job);

      expect(logSpy).toHaveBeenCalledTimes(2);
    });

    it('should silently ignore unknown job names without throwing', async () => {
      const job = buildJob('UNKNOWN_JOB_TYPE', { someField: 'someValue' });

      await expect(processor.process(job as Job)).resolves.toBeUndefined();
      // Logger should not have been called for an unrecognised job name
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
