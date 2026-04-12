import { randomUUID } from 'crypto';
import { Order } from '../../modules/orders/entities/order.entity';
import { OrderStatus } from '../../modules/orders/enums/order-status.enum';

export const buildOrder = (overrides: Partial<Order> = {}): Order => {
  const order = new Order();
  Object.assign(order, {
    id: randomUUID(),
    userId: randomUUID(),
    status: OrderStatus.CONFIRMED,
    totalAmount: 9.99,
    idempotencyKey: null,
    orderItems: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return order;
};
