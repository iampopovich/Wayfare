import { IsNumber, IsObject } from 'class-validator';

export class HealthDto {
  @IsNumber()
  totalCalories: number;

  @IsObject()
  activityBreakdown: Record<string, number>;
}
