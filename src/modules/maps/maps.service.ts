import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OSMRepository } from '../repositories/maps/osm.repository';
import { ILocation } from '../repositories/base.repository';
import { IRoute } from '../repositories/maps/base-maps.repository';
import { PlaceDetailsDto } from '../../models/base/place-details.dto';
import { SearchResultDto } from '../../models/base/search-result.dto';

export interface ISearchPlacesOptions {
  query: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  source?: 'osm' | 'all';
}

export interface IDirectionsOptions {
  origin: string;
  destination: string;
  mode?: string;
  waypoints?: string[];
}

/**
 * Maps service - business logic for maps operations
 */
@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly osmRepository: OSMRepository,
  ) {}

  /**
   * Search for places
   */
  async searchPlaces(options: ISearchPlacesOptions): Promise<SearchResultDto> {
    try {
      const source = options.source || 'osm';

      switch (source) {
        case 'osm':
          return this.searchOSM(options);
        case 'all':
        default:
          return this.searchAll(options);
      }
    } catch (error) {
      this.logger.error(`Search places error: ${error.message}`);
      throw new HttpException(
        `Failed to search places: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get place details by ID
   */
  async getPlaceDetails(placeId: string, source?: string): Promise<PlaceDetailsDto> {
    try {
      // Use OSM by default
      return await this.osmRepository.getPlaceDetails(placeId);
    } catch (error) {
      this.logger.error(`Get place details error: ${error.message}`);
      throw new HttpException(
        `Failed to get place details: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get directions between two points
   */
  async getDirections(options: IDirectionsOptions): Promise<IRoute> {
    try {
      // Geocode origin and destination using OSM
      const [originLocation, destLocation] = await Promise.all([
        this.geocodeLocation(options.origin),
        this.geocodeLocation(options.destination),
      ]);

      // Parse waypoints if provided
      let waypoints: ILocation[] = [];
      if (options.waypoints?.length) {
        waypoints = await Promise.all(
          options.waypoints.map((wp) => this.geocodeLocation(wp)),
        );
      }

      // Get directions from OSM (OSRM)
      return await this.osmRepository.getDirections(
        originLocation,
        destLocation,
        options.mode || 'driving',
        waypoints.length > 0 ? waypoints : undefined,
      );
    } catch (error) {
      this.logger.error(`Get directions error: ${error.message}`);
      throw new HttpException(
        `Failed to get directions: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Geocode a location string to coordinates
   */
  private async geocodeLocation(location: string): Promise<ILocation> {
    // Use OSM (free, no API key required)
    return await this.osmRepository.geocode(location);
  }

  /**
   * Search using OpenStreetMap
   */
  private async searchOSM(options: ISearchPlacesOptions): Promise<SearchResultDto> {
    const results = await this.osmRepository.searchPlaces({
      query: options.query,
      location:
        options.latitude && options.longitude
          ? { latitude: options.latitude, longitude: options.longitude }
          : undefined,
      filters: { radius: options.radius, limit: 20 },
    });

    return {
      results: results.items,
      totalCount: results.totalCount,
      hasMore: results.hasMore,
      metadata: results.metadata,
    };
  }

  /**
   * Search across all providers (OSM only)
   */
  private async searchAll(options: ISearchPlacesOptions): Promise<SearchResultDto> {
    // Use only OSM
    return this.searchOSM(options);
  }
}
