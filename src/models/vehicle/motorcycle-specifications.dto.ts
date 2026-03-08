import { IsString, IsNumber, IsOptional } from 'class-validator';

export class MotorcycleSpecificationsDto {
  @IsString()
  @IsOptional()
  model: string = 'Yamaha MT-07';

  @IsNumber()
  @IsOptional()
  fuelConsumption: number = 4.5; // L/100km

  @IsString()
  @IsOptional()
  fuelType: string = 'gasoline';

  @IsNumber()
  @IsOptional()
  tankCapacity: number = 14; // liters

  @IsNumber()
  @IsOptional()
  initialFuel: number = 14; // liters
}
