import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { BaseMapsRepository, IRoute, IRouteSegment } from './base-maps.repository';
import { ISearchOptions, ISearchResult, ILocation } from '../base.repository';
import { PlaceDetailsDto } from '../../../models/base/place-details.dto';
import { GeoLocationDto } from '../../../models/base/geo-location.dto';

/**
 * OpenStreetMap (OSM) repository using Nominatim API
 * Free alternative to Google Maps with different rate limits
 */
@Injectable()
export class OSMRepository extends BaseMapsRepository {
  private readonly httpClient: AxiosInstance;

  constructor(protected readonly configService: ConfigService) {
    super(configService);

    this.httpClient = axios.create({
      baseURL: 'https://nominatim.openstreetmap.org',
      headers: {
        'User-Agent': 'Wayfare/1.0',
      },
    });
  }

  async geocode(address: string): Promise<ILocation> {
    try {
      this.logger.log(`Geocoding address: "${address}"`);
      const response = await this.httpClient.get('/search', {
        params: { q: address, format: 'json', limit: 1 },
      });

      if (!response.data || response.data.length === 0) {
        throw new Error(`No geocoding results found for "${address}"`);
      }

      const result = response.data[0];
      this.logger.log(`Geocoded "${address}" to: ${result.lat},${result.lon}`);
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        address: result.display_name,
        placeId: result.place_id,
      };
    } catch (error) {
      this.logger.error(`OSM geocoding error for "${address}": ${error.message}`);
      throw error;
    }
  }

  async getDirections(
    origin: ILocation,
    destination: ILocation,
    mode: string = 'driving',
    waypoints?: ILocation[],
  ): Promise<IRoute> {
    // OSM routing via OSRM (Open Source Routing Machine)
    // OSRM expects coordinates in longitude,latitude;longitude,latitude format
    const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;

    try {
      this.logger.log(`Requesting OSRM route: ${mode}/${coordinates}`);
      const response = await axios.get(
        `http://router.project-osrm.org/route/v1/${mode}/${coordinates}`,
        {
          params: { overview: 'full', geometries: 'geojson' },
        },
      );

      if (!response.data.routes || response.data.routes.length === 0) {
        throw new Error('No route found');
      }

      this.logger.log(`OSRM route found: ${response.data.routes[0].distance}m, ${response.data.routes[0].duration}s`);
      return this.transformRoute(response.data.routes[0], origin, destination);
    } catch (error) {
      this.logger.error(
        `OSRM routing error: ${error.message}. Origin: ${origin.latitude},${origin.longitude}, Destination: ${destination.latitude},${destination.longitude}`,
      );
      throw new Error(`Routing failed: ${error.response?.status ? `HTTP ${error.response.status}` : error.message}`);
    }
  }

  async searchPlaces(options: ISearchOptions): Promise<ISearchResult> {
    try {
      const response = await this.httpClient.get('/search', {
        params: {
          q: options.query,
          format: 'json',
          limit: options.filters?.limit || 20,
          ...(options.location && {
            viewbox: `${options.location.longitude - 0.1},${options.location.latitude + 0.1},${options.location.longitude + 0.1},${options.location.latitude - 0.1}`,
            bounded: 1,
          }),
        },
      });

      return {
        items: response.data.map(this.transformPlace.bind(this)),
        totalCount: response.data.length,
        hasMore: false,
      };
    } catch (error) {
      this.logger.error(`OSM search error: ${error.message}`);
      throw error;
    }
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetailsDto> {
    try {
      // OSM Details API
      const [osmType, osmId] = placeId.split('/');
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/details`,
        {
          params: {
            osmtype: osmType,
            osmid: osmId,
            format: 'json',
            addressdetails: 1,
          },
        },
      );

      return this.transformPlaceDetails(response.data);
    } catch (error) {
      this.logger.error(`OSM place details error for "${placeId}": ${error.message}`);
      throw error;
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      const response = await this.httpClient.get('/reverse', {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
        },
      });

      return response.data.display_name || 'Unknown address';
    } catch (error) {
      this.logger.error(`OSM reverse geocoding error: ${error.message}`);
      throw error;
    }
  }

  protected transformRoute(routeData: any, origin: ILocation, destination: ILocation): IRoute {
    const geometry = routeData.geometry;
    const legs: any[] = [];

    // OSRM returns a single route, we need to create segments
    legs.push({
      distance: routeData.distance,
      duration: routeData.duration / 60, // seconds to minutes
      steps: [],
    });

    const segments: IRouteSegment[] = [
      {
        startLocation: origin,
        endLocation: destination,
        distance: routeData.distance,
        duration: routeData.duration / 60,
        polyline: '',
        instructions: [],
      },
    ];

    const pathPoints = geometry?.coordinates?.map((coord: number[]) => [
      coord[1],
      coord[0],
    ]) || [];

    return {
      segments,
      totalDistance: routeData.distance,
      totalDuration: routeData.duration / 60,
      pathPoints,
    };
  }

  protected transformPlace(placeData: any): PlaceDetailsDto {
    return {
      id: `${placeData.osm_type}/${placeData.osm_id}`,
      name: placeData.name || placeData.display_name,
      location: {
        latitude: parseFloat(placeData.lat),
        longitude: parseFloat(placeData.lon),
        address: placeData.display_name,
      },
      description: placeData.display_name,
      amenities: placeData.type ? [placeData.type] : [],
      metadata: {
        osmType: placeData.osm_type,
        osmId: placeData.osm_id,
        placeRank: placeData.place_rank,
      },
    };
  }

  protected transformPlaceDetails(placeData: any): PlaceDetailsDto {
    return {
      id: `${placeData.osm_type}/${placeData.osm_id}`,
      name: placeData.name || 'Unknown',
      location: {
        latitude: parseFloat(placeData.lat),
        longitude: parseFloat(placeData.lon),
        address: placeData.address?.road
          ? `${placeData.address.road}, ${placeData.address.city || placeData.address.town || ''}`.trim()
          : placeData.display_name,
      },
      description: placeData.display_name,
      amenities: placeData.category ? [placeData.category] : [],
      metadata: {
        osmType: placeData.osm_type,
        osmId: placeData.osm_id,
        address: placeData.address,
        extratags: placeData.extratags,
      },
    };
  }
}
