import { IsNumber, IsString, IsOptional } from 'class-validator';

export class TransportCostsDto {
  @IsNumber()
  totalCost: number;

  @IsString()
  currency: string = 'USD';

  @IsNumber()
  @IsOptional()
  fuelCost?: number;

  @IsNumber()
  @IsOptional()
  ticketCost?: number;

  @IsNumber()
  @IsOptional()
  foodCost?: number;

  @IsNumber()
  @IsOptional()
  waterCost?: number;

  @IsNumber()
  @IsOptional()
  accommodationCost?: number;

  @IsNumber()
  @IsOptional()
  maintenanceCost?: number;

  @IsNumber()
  @IsOptional()
  refuelingStops?: number;
}
