import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';

export class CarSpecificationsDto {
  @IsString()
  @IsOptional()
  model: string = 'Toyota Camry';

  @IsNumber()
  @IsOptional()
  fuelConsumption: number = 7.5; // L/100km

  @IsString()
  @IsIn(['gasoline', 'diesel', 'electric', '92', '95', '98'])
  @IsOptional()
  fuelType: string = 'gasoline';

  @IsNumber()
  @IsOptional()
  tankCapacity: number = 60; // liters

  @IsNumber()
  @IsOptional()
  initialFuel: number = 60; // liters
}
