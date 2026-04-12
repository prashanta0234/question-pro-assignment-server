import { randomUUID } from 'crypto';
import { GroceryItem } from '../../modules/groceries/entities/grocery-item.entity';

export const buildGroceryItem = (overrides: Partial<GroceryItem> = {}): GroceryItem => {
  const item = new GroceryItem();
  Object.assign(item, {
    id: randomUUID(),
    name: 'Test Milk',
    description: 'Fresh full-fat milk',
    price: 2.99,
    stock: 100,
    lowStockNotified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });
  return item;
};
