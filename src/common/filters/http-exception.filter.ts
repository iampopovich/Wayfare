import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * HTTP Exception Filter
 * Handles all HTTP exceptions and returns formatted JSON responses
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Log the error
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${JSON.stringify(exceptionResponse)}`,
    );

    // Format the response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: this.extractMessage(exceptionResponse),
      error: this.extractError(exceptionResponse),
    };

    response.status(status).json(errorResponse);
  }

  /**
   * Extract message from exception response
   */
  private extractMessage(response: any): string | string[] {
    if (typeof response === 'string') {
      return response;
    }

    if (response?.message) {
      return response.message;
    }

    if (Array.isArray(response)) {
      return response.map((r) => r.message || r).join(', ');
    }

    return 'An unexpected error occurred';
  }

  /**
   * Extract error type from exception response
   */
  private extractError(response: any): string {
    if (typeof response === 'string') {
      return 'Http Exception';
    }

    return response?.error || 'Http Exception';
  }
}
