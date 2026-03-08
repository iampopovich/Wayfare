import { NestFactory } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

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
    Logger.log(`Request: ${req.method} ${req.path}`, 'HTTP');

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      Logger.log(
        `Response: ${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms`,
        'HTTP',
      );
    });

    next();
  });

  // Static files - serve from public directory
  const serveStaticModule = ServeStaticModule.forRoot({
    rootPath: join(process.cwd(), 'public'),
    exclude: ['/api*'],
  });
  // Note: ServeStaticModule is already imported in AppModule

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

  const port = configService.get<number>('PORT') || 3001;
  const host = configService.get<string>('HOST') || '0.0.0.0';

  await app.listen(port, host);
  Logger.log(`Application running on: http://${host}:${port}`, 'Bootstrap');
  Logger.log(`Swagger documentation: http://${host}:${port}/api/docs`, 'Bootstrap');
}

bootstrap();
