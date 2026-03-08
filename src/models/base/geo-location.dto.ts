import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GeoLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsString()
  @IsOptional()
  address?: string;
}
