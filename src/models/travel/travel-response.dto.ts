import { IsArray, ValidateNested, IsNumber, IsString, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { RouteDto } from '../route/route.dto';
import { TransportCostsDto } from '../costs/transport-costs.dto';
import { StopDto } from '../stops/stop.dto';

export class TravelResponseDto {
  @ValidateNested()
  @Type(() => RouteDto)
  route: RouteDto;

  @ValidateNested()
  @Type(() => TransportCostsDto)
  costs: TransportCostsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StopDto)
  @IsOptional()
  stops?: StopDto[];

  @IsObject()
  @IsOptional()
  health?: {
    totalCalories: number;
    activityBreakdown: Record<string, number>;
  };

  @IsObject()
  @IsOptional()
  weather?: {
    origin: any;
    destination: any;
  };

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recommendations?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
