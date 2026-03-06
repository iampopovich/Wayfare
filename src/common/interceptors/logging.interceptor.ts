import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logging Interceptor
 * Logs all incoming requests and outgoing responses
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, params, query } = request;

    const now = Date.now();

    // Log incoming request
    this.logger.log(
      `${method} ${url} - Incoming Request\n` +
        `  Params: ${JSON.stringify(params)}\n` +
        `  Query: ${JSON.stringify(query)}\n` +
        `  Body: ${JSON.stringify(body)}`,
    );

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - now;
        const response = context.switchToHttp().getResponse();
        const status = response.statusCode;

        // Log outgoing response
        this.logger.log(
          `${method} ${url} - ${status} - ${duration}ms\n` +
            `  Response: ${JSON.stringify(data)?.substring(0, 200)}${JSON.stringify(data)?.length > 200 ? '...' : ''}`,
        );
      }),
    );
  }
}
