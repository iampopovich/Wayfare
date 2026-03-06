import { IsNumber, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { RouteSegmentDto } from './route-segment.dto';

export class RouteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteSegmentDto)
  segments: RouteSegmentDto[];

  @IsNumber()
  totalDistance: number; // meters

  @IsNumber()
  totalDuration: number; // minutes

  @IsArray()
  @IsArray({ each: true })
  pathPoints: number[][]; // [[lat, lng], ...]
}
