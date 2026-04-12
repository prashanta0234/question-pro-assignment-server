import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../users/enums/role.enum';
import { extractRequestCtx } from '../../../common/helpers/request-context.helper';
import { GroceryReadService } from '../services/grocery-read.service';
import { GroceryCreateService } from '../services/grocery-create.service';
import { GroceryUpdateService } from '../services/grocery-update.service';
import { GroceryDeleteService } from '../services/grocery-delete.service';
import { GroceryInventoryService } from '../services/grocery-inventory.service';
import { CreateGroceryDto } from '../dto/create-grocery.dto';
import { UpdateGroceryDto } from '../dto/update-grocery.dto';
import { UpdateInventoryDto } from '../dto/update-inventory.dto';
import { AdminGroceryQueryDto } from '../dto/admin-grocery-query.dto';
import { GroceryItem } from '../entities/grocery-item.entity';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';

@ApiTags('Admin Groceries')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN)
@Controller('admin/groceries')
export class GroceriesAdminController {
  constructor(
    private readonly readService: GroceryReadService,
    private readonly createService: GroceryCreateService,
    private readonly updateService: GroceryUpdateService,
    private readonly deleteService: GroceryDeleteService,
    private readonly inventoryService: GroceryInventoryService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new grocery item' })
  @ApiResponse({ status: 201, description: 'Item created', type: GroceryItem })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Admin only' })
  create(
    @Body() dto: CreateGroceryDto,
    @Req() req: Request & { id?: string },
  ): Promise<GroceryItem> {
    return this.createService.create(dto, extractRequestCtx(req));
  }

  @Get()
  @ApiOperation({
    summary: 'List all grocery items (including deleted)',
    description: 'Pass ?includeDeleted=true to see soft-deleted items.',
  })
  @ApiResponse({ status: 200, description: 'Paginated listing (admin view)' })
  findAll(
    @Query() query: AdminGroceryQueryDto,
  ): Promise<PaginatedResult<GroceryItem>> {
    return this.readService.findAll(query, query.includeDeleted === true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single grocery item (including soft-deleted)' })
  @ApiResponse({ status: 200, description: 'Item found' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<GroceryItem> {
    return this.readService.findByIdOrFailAdmin(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update grocery item details (name, description, price)' })
  @ApiResponse({ status: 200, description: 'Item updated', type: GroceryItem })
  @ApiResponse({ status: 404, description: 'Item not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroceryDto,
    @Req() req: Request & { id?: string },
  ): Promise<GroceryItem> {
    return this.updateService.update(id, dto, extractRequestCtx(req));
  }

  @Patch(':id/inventory')
  @ApiOperation({
    summary: 'Set inventory stock level',
    description: 'Sets absolute stock value. Not a delta. Syncs Redis counter immediately.',
  })
  @ApiResponse({ status: 200, description: 'Stock updated', type: GroceryItem })
  @ApiResponse({ status: 404, description: 'Item not found' })
  setStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryDto,
    @Req() req: Request & { id?: string },
  ): Promise<GroceryItem> {
    return this.inventoryService.setStock(id, dto, extractRequestCtx(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a grocery item' })
  @ApiResponse({ status: 200, description: 'Item soft-deleted' })
  @ApiResponse({ status: 404, description: 'Item not found or already deleted' })
  async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { id?: string },
  ): Promise<{ message: string }> {
    await this.deleteService.softDelete(id, extractRequestCtx(req));
    return { message: 'Item deleted successfully' };
  }
}
