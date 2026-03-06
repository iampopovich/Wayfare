import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

/**
 * API Key Guard
 * Protects routes by requiring a valid API key in the request headers
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private readonly apiKeyHeader = 'X-API-Key';

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers[this.apiKeyHeader.toLowerCase()] || request.query.apiKey;

    if (!apiKey) {
      this.logger.warn(`Missing API key for ${request.method} ${request.url}`);
      return false;
    }

    const validApiKeys = this.configService.get<string[]>('API_KEYS') || [];
    
    // Also check single API_KEY for backwards compatibility
    const singleApiKey = this.configService.get<string>('API_KEY');
    if (singleApiKey) {
      validApiKeys.push(singleApiKey);
    }

    const isValid = validApiKeys.includes(apiKey);

    if (!isValid) {
      this.logger.warn(`Invalid API key for ${request.method} ${request.url}`);
    }

    return isValid;
  }
}
