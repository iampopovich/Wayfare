import {
  Controller,
  Get,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { MapsService } from './maps.service';
import { SearchResultDto } from '../../models/base/search-result.dto';
import { PlaceDetailsDto } from '../../models/base/place-details.dto';
import { SearchPlacesDto, PlaceDetailsQueryDto, DirectionsQueryDto } from './dto';

/**
 * Maps Controller
 * Handles all maps and places-related HTTP requests
 */
@ApiTags('maps')
@Controller('maps')
export class MapsController {
  private readonly logger = new Logger(MapsController.name);

  constructor(private readonly mapsService: MapsService) {}

  /**
   * Search for places
   */
  @Get('search')
  @ApiOperation({ 
    summary: 'Search for places',
    description: 'Search for places by query with optional location and radius filters',
  })
  @ApiQuery({ name: 'query', required: true, type: String, description: 'Search query' })
  @ApiQuery({ name: 'latitude', required: false, type: Number, description: 'Latitude for location-based search' })
  @ApiQuery({ name: 'longitude', required: false, type: Number, description: 'Longitude for location-based search' })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Search radius in meters (max 50000)' })
  @ApiQuery({ name: 'source', required: false, enum: ['osm', 'all'], description: 'Data source' })
  @ApiResponse({ 
    status: 200, 
    type: SearchResultDto,
    description: 'List of places matching the search query',
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async searchPlaces(@Query() query: SearchPlacesDto): Promise<SearchResultDto> {
    this.logger.log(`Search request: ${query.query}`);
    return await this.mapsService.searchPlaces(query);
  }

  /**
   * Get place details
   */
  @Get('place/:placeId')
  @ApiOperation({ 
    summary: 'Get place details',
    description: 'Get detailed information about a specific place by ID',
  })
  @ApiQuery({ 
    name: 'source', 
    required: false, 
    type: String, 
    description: 'Data source (google or osm)',
    example: 'google',
  })
  @ApiResponse({ 
    status: 200, 
    type: PlaceDetailsDto,
    description: 'Detailed information about the place',
  })
  @ApiResponse({ status: 404, description: 'Place not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPlaceDetails(
    @Param('placeId') placeId: string,
    @Query() query: PlaceDetailsQueryDto,
  ): Promise<PlaceDetailsDto> {
    this.logger.log(`Place details request: ${placeId} (source: ${query.source})`);
    return await this.mapsService.getPlaceDetails(placeId, query.source);
  }

  /**
   * Get directions
   */
  @Get('directions')
  @ApiOperation({ 
    summary: 'Get directions',
    description: 'Get directions between origin and destination with optional waypoints',
  })
  @ApiQuery({ name: 'origin', required: true, type: String, description: 'Starting point address' })
  @ApiQuery({ name: 'destination', required: true, type: String, description: 'Destination address' })
  @ApiQuery({ name: 'mode', required: false, type: String, description: 'Travel mode (driving, walking, bicycling, transit)' })
  @ApiQuery({ name: 'waypoints', required: false, type: String, description: 'Comma-separated list of waypoint addresses' })
  @ApiResponse({ 
    status: 200, 
    description: 'Route with segments, distance, and duration',
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid parameters' })
  @ApiResponse({ status: 404, description: 'Route not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getDirections(@Query() query: DirectionsQueryDto) {
    this.logger.log(`Directions request: ${query.origin} to ${query.destination}`);
    
    // Parse waypoints from comma-separated string to array
    const waypoints = query.waypoints ? query.waypoints.split(',').map(wp => wp.trim()) : undefined;
    
    return await this.mapsService.getDirections({
      origin: query.origin,
      destination: query.destination,
      mode: query.mode,
      waypoints,
    });
  }
}
