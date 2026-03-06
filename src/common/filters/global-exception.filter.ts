import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

/**
 * Global Exception Filter
 * Catches all unhandled exceptions and returns formatted JSON responses
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly httpExceptionFilter = new HttpExceptionFilter();

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // If it's an HTTP exception, use the HTTP exception filter
    if (exception?.getStatus) {
      return this.httpExceptionFilter.catch(exception, host);
    }

    // Log the full error stack
    this.logger.error(
      `${request.method} ${request.url} - Unhandled Exception`,
      exception?.stack,
    );

    // Determine status code
    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    // Format the response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: this.getErrorMessage(exception),
      error: 'Internal Server Error',
    };

    response.status(status).json(errorResponse);
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(exception: any): string {
    if (!exception) {
      return 'An unexpected error occurred';
    }

    // Check for common error types
    if (exception instanceof Error) {
      // Don't expose internal error details in production
      if (process.env.NODE_ENV === 'production') {
        return 'An unexpected error occurred';
      }
      return exception.message;
    }

    if (typeof exception === 'string') {
      return exception;
    }

    if (exception?.message) {
      return exception.message;
    }

    return 'An unexpected error occurred';
  }
}
