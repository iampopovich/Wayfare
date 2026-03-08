import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';
import { MapsProvider } from './maps.provider';
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
    OSMRepository,
  ],
  exports: [MapsService],
})
export class MapsModule {}
