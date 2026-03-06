import { IsString, IsNumber, IsObject } from 'class-validator';

export class CostDto {
  @IsNumber()
  totalAmount: number;

  @IsString()
  currency: string = 'USD';

  @IsObject()
  breakdown: Record<string, number>;
}
