import { IsString, IsEnum, IsOptional, IsInt, Min, Max, ValidateNested, IsBoolean, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { TransportationType } from '../../../models/travel/transportation-type.enum';
import { CarSpecificationsDto } from '../../../models/vehicle/car-specifications.dto';
import { MotorcycleSpecificationsDto } from '../../../models/vehicle/motorcycle-specifications.dto';
import { BudgetRangeDto } from '../../../models/travel/budget-range.dto';
import { OvernightStayDto } from '../../../models/travel/overnight-stay.dto';

/**
 * DTO for plan travel request
 */
export class PlanTravelDto {
  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsEnum(TransportationType)
  transportationType: TransportationType;

  @IsOptional()
  @ValidateNested()
  @Type(() => CarSpecificationsDto)
  carSpecifications?: CarSpecificationsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MotorcycleSpecificationsDto)
  motorcycleSpecifications?: MotorcycleSpecificationsDto;

  @IsBoolean()
  @IsOptional()
  preferDirectRoutes?: boolean = true;

  @IsInt()
  @IsOptional()
  maxTransfers?: number;

  @IsInt()
  @Min(1)
  @Max(10)
  passengers: number = 1;

  @IsOptional()
  @ValidateNested()
  @Type(() => BudgetRangeDto)
  budget?: BudgetRangeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OvernightStayDto)
  overnightStay?: OvernightStayDto;

  @IsObject()
  @IsOptional()
  preferences?: Record<string, any>;
}
