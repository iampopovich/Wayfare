import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransportationType } from './transportation-type.enum';
import { CarSpecificationsDto } from '../vehicle/car-specifications.dto';
import { MotorcycleSpecificationsDto } from '../vehicle/motorcycle-specifications.dto';
import { BudgetRangeDto } from './budget-range.dto';
import { OvernightStayDto } from './overnight-stay.dto';

export class TravelRequestDto {
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
}
