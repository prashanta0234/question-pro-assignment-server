import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_ORDER } from '../constants/queue-names.const';

interface OrderConfirmationPayload {
  orderId: string;
  userId: string;
}

@Processor(QUEUE_ORDER)
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  async process(job: Job): Promise<void> {
    if (job.name === 'SEND_ORDER_CONFIRMATION') {
      await this.handleOrderConfirmation(job as Job<OrderConfirmationPayload>);
    }
  }

  private async handleOrderConfirmation(job: Job<OrderConfirmationPayload>): Promise<void> {
    const { orderId, userId } = job.data;

    this.logger.log(
      { orderId, userId, jobId: job.id },
      'Processing SEND_ORDER_CONFIRMATION — email transport stub',
    );

    // Email transport stub — wire in @nestjs-modules/mailer + provider in v2
    // For now: structured log is the observable side effect
    this.logger.log(
      { orderId, userId },
      'Order confirmation would be emailed here (transport not wired in v1)',
    );
  }
}
