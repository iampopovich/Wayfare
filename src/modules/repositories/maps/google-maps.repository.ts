import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { BaseMapsRepository, IRoute, IRouteSegment } from './base-maps.repository';
import { ISearchOptions, ISearchResult, ILocation } from '../base.repository';
import { PlaceDetailsDto } from '../../../models/base/place-details.dto';
import { GeoLocationDto } from '../../../models/base/geo-location.dto';

@Injectable()
export class GoogleMapsRepository extends BaseMapsRepository {
  private readonly httpClient: AxiosInstance;

  constructor(protected readonly configService: ConfigService) {
    super(configService);
    
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('Google Maps API key not configured');
    }

    this.httpClient = axios.create({
      baseURL: 'https://maps.googleapis.com/maps/api',
      params: { key: apiKey },
    });
  }

  async geocode(address: string): Promise<ILocation> {
    try {
      const response = await this.httpClient.get('/geocode/json', {
        params: { address },
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Geocoding failed: ${response.data.status}`);
      }

      const result = response.data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        address: result.formatted_address,
        placeId: result.place_id,
      };
    } catch (error) {
      this.logger.error(`Geocoding error for "${address}": ${error.message}`);
      throw error;
    }
  }

  async getDirections(
    origin: ILocation,
    destination: ILocation,
    mode: string = 'driving',
    waypoints?: ILocation[],
  ): Promise<IRoute> {
    const params: any = {
      origin: `${origin.latitude},${origin.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      mode,
    };

    if (waypoints?.length) {
      params.waypoints = waypoints
        .map((wp) => `${wp.latitude},${wp.longitude}`)
        .join('|');
    }

    const response = await this.httpClient.get('/directions/json', { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Directions failed: ${response.data.status}`);
    }

    return this.transformRoute(response.data.routes[0]);
  }

  async searchPlaces(options: ISearchOptions): Promise<ISearchResult> {
    const params: any = { query: options.query };

    if (options.location) {
      params.location = `${options.location.latitude},${options.location.longitude}`;
    }

    if (options.filters?.radius) {
      params.radius = options.filters.radius;
    }

    const response = await this.httpClient.get('/place/textsearch/json', { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Places search failed: ${response.data.status}`);
    }

    return {
      items: response.data.results.map(this.transformPlace.bind(this)),
      totalCount: response.data.results.length,
      hasMore: response.data.next_page_token !== undefined,
      metadata: { nextPageToken: response.data.next_page_token },
    };
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetailsDto> {
    try {
      const response = await this.httpClient.get('/place/details/json', {
        params: { place_id: placeId, fields: 'name,formatted_address,geometry,rating,reviews,photos,opening_hours,price_level,types,website,international_phone_number' },
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Place details failed: ${response.data.status}`);
      }

      return this.transformPlaceDetails(response.data.result);
    } catch (error) {
      this.logger.error(`Place details error for "${placeId}": ${error.message}`);
      throw error;
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      const response = await this.httpClient.get('/geocode/json', {
        params: { latlng: `${latitude},${longitude}` },
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Reverse geocoding failed: ${response.data.status}`);
      }

      return response.data.results[0]?.formatted_address || 'Unknown address';
    } catch (error) {
      this.logger.error(`Reverse geocoding error: ${error.message}`);
      throw error;
    }
  }

  protected transformRoute(routeData: any): IRoute {
    const segments: IRouteSegment[] = routeData.legs.map((leg: any) => ({
      startLocation: {
        latitude: leg.start_location.lat,
        longitude: leg.start_location.lng,
        address: leg.start_address,
      },
      endLocation: {
        latitude: leg.end_location.lat,
        longitude: leg.end_location.lng,
        address: leg.end_address,
      },
      distance: leg.distance.value,
      duration: leg.duration.value / 60, // seconds to minutes
      polyline: leg.steps.map((s: any) => s.polyline?.points || '').join(''),
      instructions: leg.steps.map((s: any) => 
        s.html_instructions.replace(/<[^>]*>/g, '') // Strip HTML tags
      ),
    }));

    const totalDistance = routeData.legs.reduce(
      (sum: number, leg: any) => sum + leg.distance.value,
      0,
    );

    const totalDuration = routeData.legs.reduce(
      (sum: number, leg: any) => sum + leg.duration.value / 60,
      0,
    );

    return {
      segments,
      totalDistance,
      totalDuration,
      pathPoints: this.decodePolyline(routeData.overview_polyline?.points || ''),
    };
  }

  protected decodePolyline(polyline: string): number[][] {
    if (!polyline) return [];

    const points: number[][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < polyline.length) {
      let b: number;
      let shift = 0;
      let result = 0;

      do {
        b = polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
  }

  protected transformPlace(placeData: any): PlaceDetailsDto {
    return {
      id: placeData.place_id,
      name: placeData.name,
      location: new GeoLocationDto(),
      description: placeData.formatted_address,
      rating: placeData.rating,
      reviewsCount: placeData.user_ratings_total,
      photos: placeData.photos?.map((p: any) => p.photo_reference) || [],
      amenities: placeData.types || [],
      metadata: {
        priceLevel: placeData.price_level,
        isOpen: placeData.opening_hours?.open_now,
      },
    };
  }

  protected transformPlaceDetails(placeData: any): PlaceDetailsDto {
    return {
      id: placeData.place_id,
      name: placeData.name,
      location: {
        latitude: placeData.geometry.location.lat,
        longitude: placeData.geometry.location.lng,
        address: placeData.formatted_address,
      },
      description: placeData.formatted_address,
      rating: placeData.rating,
      reviewsCount: placeData.reviews?.length || 0,
      photos: placeData.photos?.map((p: any) => p.photo_reference) || [],
      amenities: placeData.types || [],
      metadata: {
        priceLevel: placeData.price_level,
        openingHours: placeData.opening_hours,
        website: placeData.website,
        phoneNumber: placeData.international_phone_number,
        reviews: placeData.reviews,
      },
    };
  }
}
