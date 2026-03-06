import { IsString, IsNumber, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GeoLocationDto } from '../base/geo-location.dto';

export class LocationDto extends GeoLocationDto {
  @IsString()
  address: string;

  @IsString()
  placeId: string;
}
