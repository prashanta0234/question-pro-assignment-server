import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({ description: 'UUID of the grocery item to order' })
  @IsUUID()
  groceryItemId: string;

  @ApiProperty({ description: 'Quantity to order (must be >= 1)', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}
