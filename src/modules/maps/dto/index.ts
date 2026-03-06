import { IsString, IsNumber, IsOptional, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum MapsSource {
  GOOGLE = 'google',
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
  source?: MapsSource = MapsSource.ALL;
}

export class PlaceDetailsQueryDto {
  @IsString()
  source?: string = 'google';
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
