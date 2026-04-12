import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { GroceryItem } from '../../groceries/entities/grocery-item.entity';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order, (order) => order.orderItems)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column()
  groceryItemId: string;

  @ManyToOne(() => GroceryItem)
  @JoinColumn({ name: 'grocery_item_id' })
  groceryItem: GroceryItem;

  @Column({ type: 'integer' })
  quantity: number;

  /** Price snapshot at order time — immutable after insert. ADR-008 */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  /** quantity * unitPrice — pre-computed for audit trail */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;
}
