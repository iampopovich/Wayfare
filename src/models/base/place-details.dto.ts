import { IsString, IsNumber, IsOptional, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GeoLocationDto } from './geo-location.dto';

export class PlaceDetailsDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @ValidateNested()
  @Type(() => GeoLocationDto)
  location: GeoLocationDto;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  rating?: number;

  @IsNumber()
  @IsOptional()
  reviewsCount?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
