import { Provider } from '@nestjs/common';
import { MapsService } from './maps.service';
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
    osmRepository: OSMRepository,
  ) => {
    return new MapsService(
      configService,
      osmRepository,
    );
  },
  inject: [ConfigService, OSMRepository],
};

/**
 * Maps Provider - legacy support, use MapsServiceProvider instead
 */
export const MapsProvider: Provider = MapsServiceProvider;
