import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { TravelService } from './travel.service';
import { TravelRequestDto } from '../../models/travel/travel-request.dto';
import { TravelResponseDto } from '../../models/travel/travel-response.dto';
import { PlanTravelDto } from './dto/plan-travel.dto';

/**
 * Travel Controller
 * Handles travel planning and route optimization requests
 */
@ApiTags('travel')
@Controller('travel')
export class TravelController {
  private readonly logger = new Logger(TravelController.name);

  constructor(private readonly travelService: TravelService) {}

  /**
   * Plan a travel route
   */
  @Post('route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Plan travel route',
    description: 'Plan a complete travel itinerary with route, costs, stops, and recommendations',
  })
  @ApiBody({ 
    type: TravelRequestDto,
    description: 'Travel request with origin, destination, and preferences',
    examples: {
      car: {
        summary: 'Travel by car',
        value: {
          origin: 'New York, NY',
          destination: 'Boston, MA',
          transportationType: 'car',
          passengers: 2,
          carSpecifications: {
            fuelConsumption: 7.5,
            fuelType: 'gasoline',
          },
        },
      },
      motorcycle: {
        summary: 'Travel by motorcycle',
        value: {
          origin: 'San Francisco, CA',
          destination: 'Los Angeles, CA',
          transportationType: 'motorcycle',
          passengers: 1,
          motorcycleSpecifications: {
            fuelConsumption: 4.0,
            fuelType: 'gasoline',
          },
        },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    type: TravelResponseDto,
    description: 'Complete travel plan with route, costs, and recommendations',
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - invalid input parameters',
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error during travel planning',
  })
  async planRoute(@Body() travelRequest: TravelRequestDto): Promise<TravelResponseDto> {
    this.logger.log(`Travel planning request: ${travelRequest.origin} -> ${travelRequest.destination}`);

    try {
      // Validate request
      if (!travelRequest.origin || !travelRequest.destination) {
        throw new HttpException(
          'Origin and destination are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (travelRequest.origin === travelRequest.destination) {
        throw new HttpException(
          'Origin and destination must be different',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Plan the travel
      return await this.travelService.planTravel(travelRequest);
    } catch (error) {
      this.logger.error(`Travel planning error: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to plan travel: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
