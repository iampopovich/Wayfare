import { IsString, IsInt, IsArray, IsOptional, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto } from '../location/location.dto';

export class StopDto {
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @IsString()
  type: string; // 'rest', 'food', 'fuel', etc.

  @IsInt()
  duration: number; // minutes

  @IsArray()
  @IsString({ each: true })
  facilities: string[];

  @IsOptional()
  @IsNumber()
  calories?: number;

  @IsOptional()
  @IsString()
  name?: string;
}
