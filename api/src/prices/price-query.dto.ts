import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Query string for GET /prices. */
export class PriceQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  item!: string;

  @IsOptional()
  @IsString()
  cities?: string;

  @IsOptional()
  @IsString()
  qualities?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  enchantment?: number;

  @IsOptional()
  @IsIn(['es', 'en'])
  locale?: 'es' | 'en';
}
