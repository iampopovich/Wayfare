import { registerAs } from '@nestjs/config';
import { IsString, IsOptional } from 'class-validator';

export class TravelConfig {
  @IsString()
  @IsOptional()
  BOOKING_API_KEY: string;

  @IsString()
  @IsOptional()
  TRIP_API_KEY: string;

  @IsString()
  @IsOptional()
  AIRBNB_API_KEY: string;
}

export default registerAs('travel', () => ({
  bookingApiKey: process.env.BOOKING_API_KEY,
  tripApiKey: process.env.TRIP_API_KEY,
  airbnbApiKey: process.env.AIRBNB_API_KEY,
}));
