import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseService } from './base.service';
import { OSMRepository } from '../modules/repositories/maps/osm.repository';
import { ISearchResult, ILocation } from '../modules/repositories/base.repository';
import { PlaceDetailsDto } from '../models/base/place-details.dto';
import { SearchResultDto } from '../models/base/search-result.dto';

export interface ISearchPlacesOptions {
  query: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  source?: 'osm' | 'all';
}

/**
 * Search service for aggregating results from multiple map providers
 */
@Injectable()
export class SearchService extends BaseService {
  constructor(
    protected readonly configService: ConfigService,
    private readonly osmRepository: OSMRepository,
  ) {
    super(configService);
  }

  /**
   * Search for places across multiple providers
   */
  async searchPlaces(options: ISearchPlacesOptions): Promise<SearchResultDto> {
    const source = options.source || 'osm';

    try {
      let results: ISearchResult;

      switch (source) {
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
      // Use OSM by default
      return await this.osmRepository.getPlaceDetails(placeId);
    } catch (error) {
      this.logger.error(`Get place details error: ${error.message}`);
      throw error;
    }
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
   * Search across all providers (OSM only)
   */
  private async searchAll(options: ISearchPlacesOptions): Promise<ISearchResult> {
    // Use only OSM
    return this.searchOSM(options);
  }
}
