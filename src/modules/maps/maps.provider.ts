import { Provider } from '@nestjs/common';
import { MapsService } from './maps.service';
import { GoogleMapsRepository } from '../repositories/maps/google-maps.repository';
import { OSMRepository } from '../repositories/maps/osm.repository';
import { ConfigService } from '@nestjs/config';

/**
 * Maps Service Provider
 * Factory provider for creating MapsService with dependencies
 */
export const MapsServiceProvider: Provider = {
  provide: MapsService,
  useFactory: (
    configService: ConfigService,
    googleMapsRepository: GoogleMapsRepository,
    osmRepository: OSMRepository,
  ) => {
    return new MapsService(
      configService,
      googleMapsRepository,
      osmRepository,
    );
  },
  inject: [ConfigService, GoogleMapsRepository, OSMRepository],
};

/**
 * Maps Provider - legacy support, use MapsServiceProvider instead
 */
export const MapsProvider: Provider = MapsServiceProvider;
