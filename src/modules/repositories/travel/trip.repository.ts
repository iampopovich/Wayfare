import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { BaseRepository, ISearchOptions, ISearchResult } from '../base.repository';

export interface ITripAdvisorLocation {
  locationId: string;
  name: string;
  latitude: string;
  longitude: string;
  rating: string;
  numReviews: string;
  priceLevel: string;
  ranking: string;
}

/**
 * TripAdvisor repository for travel recommendations
 * Note: TripAdvisor API requires partner access
 * This is a placeholder for future integration
 */
@Injectable()
export class TripRepository extends BaseRepository {
  private readonly httpClient: AxiosInstance;

  constructor(protected readonly configService: ConfigService) {
    super(configService);

    const apiKey = this.configService.get<string>('TRIP_API_KEY');

    this.httpClient = axios.create({
      baseURL: 'https://api.tripadvisor.com/api/partner/2.0',
      headers: {
        'X-TripAdvisor-API-Key': apiKey || '',
      },
    });
  }

  async search(options: ISearchOptions): Promise<ISearchResult<ITripAdvisorLocation>> {
    this.logger.warn('TripAdvisor search not yet fully implemented');

    // Placeholder implementation
    return {
      items: [],
      totalCount: 0,
      hasMore: false,
    };
  }

  async getDetails(itemId: string): Promise<ITripAdvisorLocation> {
    this.logger.warn('TripAdvisor details not yet fully implemented');
    throw new Error('TripAdvisor API not implemented');
  }

  /**
   * Search for locations by query
   */
  async searchLocations(query: string, limit: number = 10): Promise<ITripAdvisorLocation[]> {
    try {
      const response = await this.httpClient.get('/locations/search', {
        params: { q: query, limit },
      });

      return response.data.data || [];
    } catch (error) {
      this.logger.error(`TripAdvisor search error: ${error.message}`);
      return [];
    }
  }
}
