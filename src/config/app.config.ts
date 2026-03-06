import { registerAs } from '@nestjs/config';
import { IsString, IsInt, IsOptional, IsArray } from 'class-validator';

export class AppConfig {
  @IsString()
  @IsOptional()
  HOST: string = '127.0.0.1';

  @IsInt()
  @IsOptional()
  PORT: number = 3001;

  @IsArray()
  @IsOptional()
  ALLOWED_ORIGINS: string[] = ['*'];

  @IsString()
  @IsOptional()
  NODE_ENV: string = 'development';
}

export default registerAs('app', () => ({
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT, 10) || 3000,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  environment: process.env.NODE_ENV || 'development',
}));
