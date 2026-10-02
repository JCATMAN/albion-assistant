import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Query string for GET /items/suggest. */
export class SuggestQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q!: string;

  @IsOptional()
  @IsIn(['es', 'en'])
  locale?: 'es' | 'en';
}
