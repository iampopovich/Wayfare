import { registerAs } from '@nestjs/config';
import { IsString, IsOptional } from 'class-validator';

export class MapsConfig {
  @IsString()
  @IsOptional()
  GOOGLE_MAPS_API_KEY: string;

  @IsString()
  @IsOptional()
  MAPSME_API_KEY: string;
}

export default registerAs('maps', () => ({
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  mapsMeApiKey: process.env.MAPSME_API_KEY,
}));
