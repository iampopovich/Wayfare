import { registerAs } from '@nestjs/config';
import { IsString, IsOptional } from 'class-validator';

export class DeepSeekConfig {
  @IsString()
  @IsOptional()
  DEEPSEEK_API_KEY: string;

  @IsString()
  @IsOptional()
  DEEPSEEK_MODEL_NAME: string = 'deepseek-chat';
}

export default registerAs('deepseek', () => ({
  apiKey: process.env.DEEPSEEK_API_KEY,
  modelName: process.env.DEEPSEEK_MODEL_NAME || 'deepseek-chat',
}));
