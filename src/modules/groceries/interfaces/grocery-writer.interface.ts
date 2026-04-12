import { GroceryItem } from '../entities/grocery-item.entity';
import { CreateGroceryDto } from '../dto/create-grocery.dto';
import { UpdateGroceryDto } from '../dto/update-grocery.dto';
import { RequestContext } from '../../../common/interfaces/request-context.interface';

export interface IGroceryWriter {
  create(dto: CreateGroceryDto, ctx: RequestContext): Promise<GroceryItem>;
  update(id: string, dto: UpdateGroceryDto, ctx: RequestContext): Promise<GroceryItem>;
}
