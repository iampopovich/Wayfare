import { registerAs } from '@nestjs/config';
import { IsString, IsOptional } from 'class-validator';

export class OpenAIConfig {
  @IsString()
  @IsOptional()
  OPENAI_API_KEY: string;

  @IsString()
  @IsOptional()
  OPENAI_MODEL_NAME: string = 'gpt-3.5-turbo';
}

export default registerAs('openai', () => ({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo',
}));
