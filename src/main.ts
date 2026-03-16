import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });
  const configService = app.get(ConfigService);

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // CORS configuration
  app.enableCors({
    origin: configService.get<string[]>('ALLOWED_ORIGINS') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Request logging middleware
  app.use((req, res, next) => {
    const startTime = Date.now();
    const url = req.originalUrl;
    Logger.log(`Request: ${req.method} ${url}`, 'HTTP');

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      Logger.log(
        `Response: ${req.method} ${url} - Status: ${res.statusCode} - Duration: ${duration}ms`,
        'HTTP',
      );
    });

    next();
  });

  // Serve Vue frontend from dist/frontend
  app.use('/assets', express.static(join(process.cwd(), 'dist', 'frontend', 'assets')));
  app.use('/', express.static(join(process.cwd(), 'dist', 'frontend'), {
    index: 'index.html',
  }));

  // Handle SPA routing - return index.html for unknown routes
  app.use((req, res, next) => {
    // Skip API routes (req.originalUrl preserves the full path through wildcards)
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }

    const urlPath = req.originalUrl.split('?')[0];
    const filePath = join(process.cwd(), 'dist', 'frontend', urlPath);

    // Return index.html for SPA routing if file doesn't exist
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res.sendFile(join(process.cwd(), 'dist', 'frontend', 'index.html'));
    }

    next();
  });

  // Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Wayfare API')
    .setDescription('AI-powered Travel Planner API')
    .setVersion('1.0')
    .addTag('maps', 'Maps and Places operations')
    .addTag('travel', 'Travel planning and route optimization')
    .addTag('health', 'Health check endpoints')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Global exception filters
  // app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  // app.useGlobalInterceptors(new LoggingInterceptor());

  // Get port from .env file or use default
  const port = parseInt(process.env.PORT, 10) || 3000;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);
  Logger.log(`Application running on: http://${host}:${port}`, 'Bootstrap');
  Logger.log(`Swagger documentation: http://${host}:${port}/api/docs`, 'Bootstrap');
  Logger.log(`Vue frontend: http://${host}:${port}/`, 'Bootstrap');
}

bootstrap();
