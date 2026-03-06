import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseService } from './base.service';
import { GoogleMapsRepository } from '../modules/repositories/maps/google-maps.repository';
import { OSMRepository } from '../modules/repositories/maps/osm.repository';
import { ISearchResult, ILocation } from '../modules/repositories/base.repository';
import { PlaceDetailsDto } from '../models/base/place-details.dto';
import { SearchResultDto } from '../models/base/search-result.dto';

export interface ISearchPlacesOptions {
  query: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  source?: 'google' | 'osm' | 'all';
}

/**
 * Search service for aggregating results from multiple map providers
 */
@Injectable()
export class SearchService extends BaseService {
  constructor(
    protected readonly configService: ConfigService,
    private readonly googleMapsRepository: GoogleMapsRepository,
    private readonly osmRepository: OSMRepository,
  ) {
    super(configService);
  }

  /**
   * Search for places across multiple providers
   */
  async searchPlaces(options: ISearchPlacesOptions): Promise<SearchResultDto> {
    const source = options.source || 'all';
    
    try {
      let results: ISearchResult;

      switch (source) {
        case 'google':
          results = await this.searchGoogle(options);
          break;
        case 'osm':
          results = await this.searchOSM(options);
          break;
        case 'all':
        default:
          results = await this.searchAll(options);
          break;
      }

      return {
        results: results.items,
        totalCount: results.totalCount,
        hasMore: results.hasMore,
        metadata: results.metadata,
      };
    } catch (error) {
      this.logger.error(`Search error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get place details from specified or best available source
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
      throw error;
    }
  }

  /**
   * Search using Google Maps
   */
  private async searchGoogle(options: ISearchPlacesOptions): Promise<ISearchResult> {
    return this.googleMapsRepository.searchPlaces({
      query: options.query,
      location: options.latitude && options.longitude ? {
        latitude: options.latitude,
        longitude: options.longitude,
      } : undefined,
      filters: {
        radius: options.radius,
      },
    });
  }

  /**
   * Search using OpenStreetMap
   */
  private async searchOSM(options: ISearchPlacesOptions): Promise<ISearchResult> {
    return this.osmRepository.searchPlaces({
      query: options.query,
      location: options.latitude && options.longitude ? {
        latitude: options.latitude,
        longitude: options.longitude,
      } : undefined,
      filters: {
        radius: options.radius,
        limit: 20,
      },
    });
  }

  /**
   * Search across all providers and merge results
   */
  private async searchAll(options: ISearchPlacesOptions): Promise<ISearchResult> {
    try {
      const [googleResults, osmResults] = await Promise.allSettled([
        this.searchGoogle(options),
        this.searchOSM(options),
      ]);

      const items: any[] = [];
      let totalCount = 0;
      let hasMore = false;
      const seenIds = new Set<string>();

      // Add Google results first (usually higher quality)
      if (googleResults.status === 'fulfilled') {
        googleResults.value.items.forEach((item: any) => {
          if (!seenIds.has(item.id)) {
            items.push({ ...item, source: 'google' });
            seenIds.add(item.id);
          }
        });
        totalCount += googleResults.value.totalCount;
        hasMore = hasMore || googleResults.value.hasMore;
      } else {
        this.logger.warn(`Google search failed: ${googleResults.reason.message}`);
      }

      // Add OSM results
      if (osmResults.status === 'fulfilled') {
        osmResults.value.items.forEach((item: any) => {
          if (!seenIds.has(item.id)) {
            items.push({ ...item, source: 'osm' });
            seenIds.add(item.id);
          }
        });
        totalCount += osmResults.value.totalCount;
        hasMore = hasMore || osmResults.value.hasMore;
      } else {
        this.logger.warn(`OSM search failed: ${osmResults.reason.message}`);
      }

      return {
        items,
        totalCount,
        hasMore,
        metadata: {
          sources: {
            google: googleResults.status === 'fulfilled',
            osm: osmResults.status === 'fulfilled',
          },
        },
      };
    } catch (error) {
      this.logger.error(`Search all error: ${error.message}`);
      throw error;
    }
  }
}
