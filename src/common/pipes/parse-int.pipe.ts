import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Parse Int Pipe
 * Transforms and validates that a value is a valid integer
 */
@Injectable()
export class ParseIntPipe implements PipeTransform<string> {
  async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
    if (!value) {
      throw new BadRequestException('Value is required');
    }

    const parsedValue = parseInt(value, 10);

    if (isNaN(parsedValue)) {
      throw new BadRequestException(`Validation failed: "${value}" is not a valid integer`);
    }

    return parsedValue;
  }
}
