import { GroceryItem } from '../entities/grocery-item.entity';
import { GroceryQueryDto } from '../dto/grocery-query.dto';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';

export interface IGroceryReader {
  findAll(query: GroceryQueryDto, includeDeleted?: boolean): Promise<PaginatedResult<GroceryItem>>;
  findByIdOrFail(id: string): Promise<GroceryItem>;
}
