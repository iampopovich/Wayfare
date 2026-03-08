import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OSMRepository } from './maps/osm.repository';
import { MapsMeRepository } from './maps/mapsme.repository';
import { BookingRepository } from './travel/booking.repository';
import { AirbnbRepository } from './travel/airbnb.repository';
import { TripRepository } from './travel/trip.repository';
import { OpenWeatherRepository } from './weather/open-weather.repository';

/**
 * Repositories module - provides data access layer for all external services
 * Registered as global to be available throughout the application
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    // Maps repositories
    OSMRepository,
    MapsMeRepository,

    // Travel repositories
    BookingRepository,
    AirbnbRepository,
    TripRepository,

    // Weather repositories
    OpenWeatherRepository,
  ],
  exports: [
    // Export repositories for use in other modules
    OSMRepository,
    MapsMeRepository,
    BookingRepository,
    AirbnbRepository,
    TripRepository,
    OpenWeatherRepository,
  ],
})
export class RepositoriesModule {}
