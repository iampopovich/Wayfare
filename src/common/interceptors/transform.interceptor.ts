import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Transform Interceptor
 * Standardizes all API responses to a consistent format
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const request = context.switchToHttp().getRequest();
        const statusCode = response.statusCode;

        // If data is already in a standard format, return as-is
        if (data?.statusCode || data?.success !== undefined) {
          return data;
        }

        // Wrap successful responses in a standard format
        return {
          statusCode,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          data,
        };
      }),
    );
  }
}
