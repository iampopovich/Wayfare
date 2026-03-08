import { IsNumber, IsString, IsOptional } from 'class-validator';

export class PriceRangeDto {
  @IsNumber()
  @IsOptional()
  min?: number;

  @IsNumber()
  @IsOptional()
  max?: number;

  @IsString()
  @IsOptional()
  currency?: string = 'USD';
}
