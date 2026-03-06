import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AppConfig } from './app.config';

export function validate(config: Record<string, any>) {
  const validatedConfig = plainToClass(AppConfig, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
