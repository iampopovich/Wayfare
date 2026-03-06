import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * Health Controller
 * Provides health check endpoints for monitoring and Kubernetes
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * Liveness probe
   * Indicates if the application is running
   */
  @Get('live')
  @ApiOperation({ 
    summary: 'Liveness check',
    description: 'Check if the application is alive and running',
  })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  liveness(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe
   * Indicates if the application is ready to accept requests
   */
  @Get('ready')
  @ApiOperation({ 
    summary: 'Readiness check',
    description: 'Check if the application is ready to accept requests',
  })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  readiness(): { status: string; timestamp: string; checks: Record<string, string> } {
    // Add any readiness checks here (database, external services, etc.)
    const checks: Record<string, string> = {
      server: 'ok',
    };

    const allHealthy = Object.values(checks).every((value) => value === 'ok');

    return {
      status: allHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
