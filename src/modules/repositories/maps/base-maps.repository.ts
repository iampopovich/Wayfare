import { Injectable, Logger } from '@nestjs/common';
import { BaseRepository, ISearchOptions, ISearchResult, ILocation } from '../base.repository';

export interface IRouteSegment {
  startLocation: ILocation;
  endLocation: ILocation;
  distance: number; // meters
  duration: number; // minutes
  polyline: string;
  instructions: string[];
}

export interface IRoute {
  segments: IRouteSegment[];
  totalDistance: number; // meters
  totalDuration: number; // minutes
  pathPoints: number[][]; // [[lat, lng], ...]
}

/**
 * Base repository for maps providers
 */
@Injectable()
export abstract class BaseMapsRepository extends BaseRepository {
  protected readonly logger = new Logger('BaseMapsRepository');

  /**
   * Geocode an address to coordinates
   */
  abstract geocode(address: string): Promise<ILocation>;

  /**
   * Get directions between origin and destination
   */
  abstract getDirections(
    origin: ILocation,
    destination: ILocation,
    mode?: string,
    waypoints?: ILocation[],
  ): Promise<IRoute>;

  /**
   * Search for places near a location
   */
  abstract searchPlaces(options: ISearchOptions): Promise<ISearchResult>;

  /**
   * Get detailed information about a place
   */
  abstract getPlaceDetails(placeId: string): Promise<any>;

  /**
   * Reverse geocode coordinates to address
   */
  abstract reverseGeocode(latitude: number, longitude: number): Promise<string>;

  /**
   * Implementation of BaseRepository abstract method - delegates to searchPlaces
   */
  async search(options: ISearchOptions): Promise<ISearchResult> {
    return this.searchPlaces(options);
  }

  /**
   * Implementation of BaseRepository abstract method - delegates to getPlaceDetails
   */
  async getDetails(itemId: string): Promise<any> {
    return this.getPlaceDetails(itemId);
  }
}
