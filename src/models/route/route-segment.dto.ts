import { IsNumber, IsString, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto } from '../location/location.dto';

export class RouteSegmentDto {
  @ValidateNested()
  @Type(() => LocationDto)
  startLocation: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  endLocation: LocationDto;

  @IsNumber()
  distance: number; // meters

  @IsNumber()
  duration: number; // minutes

  @IsString()
  polyline: string;

  @IsArray()
  @IsString({ each: true })
  instructions: string[];
}
