import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GroceryItem } from '../entities/grocery-item.entity';
import { GroceryQueryDto } from '../dto/grocery-query.dto';
import { GroceryCacheService } from './grocery-cache.service';
import { IGroceryReader } from '../interfaces/grocery-reader.interface';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../../../common/helpers/pagination.helper';

@Injectable()
export class GroceryReadService implements IGroceryReader {
  constructor(
    @InjectRepository(GroceryItem)
    private readonly repo: Repository<GroceryItem>,
    private readonly cacheService: GroceryCacheService,
  ) {}

  async findAll(query: GroceryQueryDto, includeDeleted = false): Promise<PaginatedResult<GroceryItem>> {
    if (!includeDeleted) {
      const cached = await this.cacheService.getList(query);
      if (cached) return cached;
    }

    const qb = this.repo.createQueryBuilder('item');

    if (includeDeleted) {
      qb.withDeleted();
    } else {
      qb.andWhere('item.deletedAt IS NULL').andWhere('item.stock > 0');
    }

    if (query.search) {
      qb.andWhere('item.name ILIKE :search', { search: `%${query.search}%` });
    }

    const sortColumn = query.sortBy ?? 'name';
    qb.orderBy(`item.${sortColumn}`, query.sortOrder ?? 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    const result = buildPaginatedResult(data, total, query);

    if (!includeDeleted) {
      await this.cacheService.setList(query, result);
    }

    return result;
  }

  async findByIdOrFail(id: string): Promise<GroceryItem> {
    const cached = await this.cacheService.getItem(id);
    if (cached) return cached;

    const item = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!item) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'Grocery item not found' });
    }

    await this.cacheService.setItem(item);
    return item;
  }

  async findByIdOrFailAdmin(id: string): Promise<GroceryItem> {
    const item = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!item) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'Grocery item not found' });
    }
    return item;
  }
}
