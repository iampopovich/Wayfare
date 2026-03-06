import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';
import { MapsProvider } from './maps.provider';
import { GoogleMapsRepository } from '../repositories/maps/google-maps.repository';
import { OSMRepository } from '../repositories/maps/osm.repository';

/**
 * Maps Module
 * Provides maps and places functionality
 */
@Module({
  imports: [ConfigModule],
  controllers: [MapsController],
  providers: [
    MapsService,
    MapsProvider,
    GoogleMapsRepository,
    OSMRepository,
  ],
  exports: [MapsService],
})
export class MapsModule {}
