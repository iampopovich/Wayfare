import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class OvernightStayDto {
  @IsBoolean()
  @IsOptional()
  includeAccommodation?: boolean = false;

  @IsString()
  @IsOptional()
  accommodationType?: string = 'hotel';

  @IsNumber()
  @IsOptional()
  maxNights?: number;

  @IsNumber()
  @IsOptional()
  budgetPerNight?: number;
}
