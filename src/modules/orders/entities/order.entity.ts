import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.CONFIRMED })
  status: OrderStatus;

  /** Server-calculated — NEVER accepted from client input. ADR-008 */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  /** Used for idempotency deduplication. Unique constraint enforced at DB level. Max 128 chars (UUID v4 = 36). */
  @Column({ type: 'varchar', length: 128, nullable: true, unique: true })
  idempotencyKey: string | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  orderItems: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
