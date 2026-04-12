import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GroceryReadService } from '../services/grocery-read.service';
import { GroceryQueryDto } from '../dto/grocery-query.dto';
import { GroceryItem } from '../entities/grocery-item.entity';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';

@ApiTags('Groceries')
@ApiBearerAuth('access-token')
@Controller('groceries')
export class GroceriesPublicController {
  constructor(private readonly readService: GroceryReadService) {}

  @Get()
  @ApiOperation({
    summary: 'List available grocery items',
    description: 'Returns paginated active items (stock > 0, not deleted). Results are cached for 60s.',
  })
  @ApiResponse({ status: 200, description: 'Paginated grocery listing' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query() query: GroceryQueryDto): Promise<PaginatedResult<GroceryItem>> {
    return this.readService.findAll(query, false);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single grocery item by ID' })
  @ApiResponse({ status: 200, description: 'Grocery item found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Item not found or deleted' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<GroceryItem> {
    return this.readService.findByIdOrFail(id);
  }
}
