import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildPaginatedResult } from '../../../common/helpers/pagination.helper';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';
import { OrderQueryDto } from '../dto/order-query.dto';
import { Order } from '../entities/order.entity';

@Injectable()
export class OrderQueryService {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
  ) {}

  /** Returns paginated list of orders belonging to the authenticated user */
  async findAllByUser(userId: string, query: OrderQueryDto): Promise<PaginatedResult<Order>> {
    const sortColumn = query.sortBy ?? 'createdAt';

    const [data, total] = await this.repo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .where('order.userId = :userId', { userId })
      .orderBy(`order.${sortColumn}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return buildPaginatedResult(data, total, query);
  }

  /**
   * Returns a single order belonging to the authenticated user.
   * Ownership is enforced in the WHERE clause — a user cannot see another user's order.
   */
  async findOneByUser(id: string, userId: string): Promise<Order> {
    const order = await this.repo.findOne({
      where: { id, userId },
      relations: ['orderItems', 'orderItems.groceryItem'],
    });

    if (!order) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'Order not found' });
    }

    return order;
  }
}
