import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

// Import modules
import { MapsModule } from './modules/maps/maps.module';
import { TravelModule } from './modules/travel/travel.module';
import { AgentsModule } from './modules/agents/agents.module';
import { RepositoriesModule } from './modules/repositories/repositories.module';
import { HealthModule } from './modules/health/health.module';

// Import configuration
import appConfig from './config/app.config';
import deepseekConfig from './config/deepseek.config';
import mapsConfig from './config/maps.config';
import travelConfig from './config/travel.config';
import { validate } from './config/config.validation';

@Module({
  imports: [
    // Configuration module - global, loads .env files
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, deepseekConfig, mapsConfig, travelConfig],
      validate,
    }),

    // Static files module
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api*'],
    }),

    // Feature modules
    MapsModule,
    TravelModule,
    AgentsModule,
    RepositoriesModule,
    HealthModule,
  ],
})
export class AppModule {}
