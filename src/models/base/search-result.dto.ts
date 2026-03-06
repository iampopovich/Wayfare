import { IsArray, ValidateNested, IsNumber, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { PlaceDetailsDto } from './place-details.dto';

export class SearchResultDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaceDetailsDto)
  results: PlaceDetailsDto[];

  @IsNumber()
  totalCount: number;

  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  hasMore?: boolean = false;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
