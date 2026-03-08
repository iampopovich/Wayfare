import { Injectable, Logger } from '@nestjs/common';
import { BaseRepository, ISearchOptions, ISearchResult } from '../base.repository';

export interface IAccommodation {
  id: string;
  name: string;
  location: { latitude: number; longitude: number };
  address: string;
  rating: number;
  pricePerNight: number;
  currency: string;
  amenities: string[];
  photos: string[];
  bookingUrl?: string;
}

/**
 * Base repository for accommodation booking services
 */
@Injectable()
export abstract class BaseAccommodationRepository extends BaseRepository {
  protected readonly logger = new Logger('BaseAccommodationRepository');

  /**
   * Search for accommodations near a location
   */
  abstract searchAccommodations(
    location: { latitude: number; longitude: number },
    checkIn: Date,
    checkOut: Date,
    guests?: number,
  ): Promise<ISearchResult<IAccommodation>>;

  /**
   * Get detailed information about an accommodation
   */
  abstract getAccommodationDetails(id: string): Promise<IAccommodation>;
}
