import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TravelController } from './travel.controller';
import { TravelService } from './travel.service';
import { GoogleMapsRepository } from '../repositories/maps/google-maps.repository';
import { OpenWeatherRepository } from '../repositories/weather/open-weather.repository';
import { SearchService } from '../../services/search.service';

/**
 * Travel Module
 * Provides travel planning and route optimization functionality
 */
@Module({
  imports: [ConfigModule],
  controllers: [TravelController],
  providers: [
    TravelService,
    SearchService,
    GoogleMapsRepository,
    OpenWeatherRepository,
  ],
  exports: [TravelService],
})
export class TravelModule {}
