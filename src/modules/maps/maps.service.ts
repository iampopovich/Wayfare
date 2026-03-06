import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleMapsRepository } from '../repositories/maps/google-maps.repository';
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
  source?: 'google' | 'osm' | 'all';
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
    private readonly googleMapsRepository: GoogleMapsRepository,
    private readonly osmRepository: OSMRepository,
  ) {}

  /**
   * Search for places
   */
  async searchPlaces(options: ISearchPlacesOptions): Promise<SearchResultDto> {
    try {
      const source = options.source || 'all';

      switch (source) {
        case 'google':
          return this.searchGoogle(options);
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
      switch (source) {
        case 'osm':
          return await this.osmRepository.getPlaceDetails(placeId);
        case 'google':
        default:
          return await this.googleMapsRepository.getPlaceDetails(placeId);
      }
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
      // Geocode origin and destination
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

      // Get directions from Google Maps
      return await this.googleMapsRepository.getDirections(
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
    // Try Google Maps first, fallback to OSM
    try {
      return await this.googleMapsRepository.geocode(location);
    } catch (error) {
      this.logger.warn(`Google geocoding failed, trying OSM: ${error.message}`);
      return await this.osmRepository.geocode(location);
    }
  }

  /**
   * Search using Google Maps
   */
  private async searchGoogle(options: ISearchPlacesOptions): Promise<SearchResultDto> {
    const results = await this.googleMapsRepository.searchPlaces({
      query: options.query,
      location:
        options.latitude && options.longitude
          ? { latitude: options.latitude, longitude: options.longitude }
          : undefined,
      filters: { radius: options.radius },
    });

    return {
      results: results.items,
      totalCount: results.totalCount,
      hasMore: results.hasMore,
      metadata: results.metadata,
    };
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
   * Search across all providers and merge results
   */
  private async searchAll(options: ISearchPlacesOptions): Promise<SearchResultDto> {
    const [googleResults, osmResults] = await Promise.allSettled([
      this.searchGoogle(options),
      this.searchOSM(options),
    ]);

    const results: any[] = [];
    let totalCount = 0;
    let hasMore = false;
    const seenIds = new Set<string>();
    const metadata: any = { sources: {} };

    // Add Google results first
    if (googleResults.status === 'fulfilled') {
      googleResults.value.results.forEach((item: any) => {
        if (!seenIds.has(item.id)) {
          results.push({ ...item, source: 'google' });
          seenIds.add(item.id);
        }
      });
      totalCount += googleResults.value.totalCount;
      hasMore = hasMore || googleResults.value.hasMore;
      metadata.sources.google = true;
    } else {
      this.logger.warn(`Google search failed: ${googleResults.reason.message}`);
      metadata.sources.google = false;
    }

    // Add OSM results
    if (osmResults.status === 'fulfilled') {
      osmResults.value.results.forEach((item: any) => {
        if (!seenIds.has(item.id)) {
          results.push({ ...item, source: 'osm' });
          seenIds.add(item.id);
        }
      });
      totalCount += osmResults.value.totalCount;
      hasMore = hasMore || osmResults.value.hasMore;
      metadata.sources.osm = true;
    } else {
      this.logger.warn(`OSM search failed: ${osmResults.reason.message}`);
      metadata.sources.osm = false;
    }

    return {
      results,
      totalCount,
      hasMore,
      metadata,
    };
  }
}
