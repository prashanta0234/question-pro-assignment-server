import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { GroceryQueryDto } from './grocery-query.dto';

export class AdminGroceryQueryDto extends GroceryQueryDto {
  @ApiPropertyOptional({
    description: 'Include soft-deleted items in the result',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeDeleted?: boolean;
}
