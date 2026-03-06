import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Logger Middleware
 * Logs all HTTP requests with method, URL, and timing information
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { method, originalUrl } = request;
    const startTime = Date.now();

    // Log request
    this.logger.log(`${method} ${originalUrl}`);

    // Log response on finish
    response.on('finish', () => {
      const { statusCode } = response;
      const duration = Date.now() - startTime;
      this.logger.log(`${method} ${originalUrl} ${statusCode} ${duration}ms`);
    });

    next();
  }
}
