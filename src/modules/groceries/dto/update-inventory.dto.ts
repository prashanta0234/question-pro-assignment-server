import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateInventoryDto {
  @ApiProperty({
    example: 150,
    description: 'Absolute stock quantity to set (>= 0). This is NOT a delta — it replaces current stock.',
    minimum: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999_999)
  stock: number;
}
