import { IsString, IsNumber, IsOptional, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum MapsSource {
  OSM = 'osm',
  ALL = 'all',
}

export class SearchPlacesDto {
  @IsString()
  query: string;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(50000)
  radius?: number;

  @IsEnum(MapsSource)
  @IsOptional()
  source?: MapsSource = MapsSource.OSM;
}

export class PlaceDetailsQueryDto {
  @IsString()
  @IsOptional()
  source?: string;
}

export class DirectionsQueryDto {
  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsString()
  @IsOptional()
  mode?: string = 'driving';

  @IsString()
  @IsOptional()
  waypoints?: string; // Comma-separated list of addresses
}
