import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { extractRequestCtx } from '../../../common/helpers/request-context.helper';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderQueryDto } from '../dto/order-query.dto';
import { OrderCommandService } from '../services/order-command.service';
import { OrderQueryService } from '../services/order-query.service';

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly commandService: OrderCommandService,
    private readonly queryService: OrderQueryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ orders: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Place a new order',
    description:
      'Creates a confirmed order. Uses 3-layer overselling prevention: ' +
      'Redis atomic pre-check → SELECT FOR UPDATE → CHECK constraint. ' +
      'Pass `Idempotency-Key` header to safely retry without duplicate orders.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Client-generated UUID. Same key within 24h returns the cached response.',
    required: false,
  })
  @ApiResponse({ status: 201, description: 'Order placed successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'One or more items not found' })
  @ApiResponse({ status: 409, description: 'Insufficient stock' })
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: { sub: string },
    @Req() req: Request & { id?: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (idempotencyKey && idempotencyKey.length > 128) {
      throw new BadRequestException({
        error: 'INVALID_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key must be at most 128 characters',
      });
    }
    return this.commandService.createOrder(
      user.sub,
      dto,
      extractRequestCtx(req),
      idempotencyKey || undefined,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List own orders (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated order list' })
  findAll(@CurrentUser() user: { sub: string }, @Query() query: OrderQueryDto) {
    return this.queryService.findAllByUser(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single order by ID (own orders only)' })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found or does not belong to user' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.queryService.findOneByUser(id, user.sub);
  }
}
