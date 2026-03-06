import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RouteAgent } from './route.agent';
import { AccommodationAgent } from './accommodation.agent';
import { FuelAgent } from './fuel.agent';
import { CostAgent } from './cost.agent';
import { HealthAgent } from './health.agent';
import { StopsAgent } from './stops.agent';
import { FoodAgent } from './food.agent';
import { WeatherAgent } from './weather.agent';
import { TravelRequestDto } from '../../models/travel/travel-request.dto';
import { RouteDto } from '../../models/route/route.dto';
import { TransportCostsDto } from '../../models/costs/transport-costs.dto';
import { IWeatherData } from '../repositories/weather/open-weather.repository';

/**
 * Coordinator response interface
 */
export interface CoordinatorResponse {
  routeAnalysis?: any;
  accommodationRecommendations?: any;
  fuelAnalysis?: any;
  costAnalysis?: any;
  healthAnalysis?: any;
  stopsRecommendations?: any;
  foodRecommendations?: any;
  weatherAnalysis?: any;
  summary: {
    totalEstimatedCost: number;
    totalTravelTime: number;
    recommendedStops: number;
    keyRecommendations: string[];
  };
}

/**
 * Agents Coordinator - Orchestrates multiple AI agents for comprehensive travel planning
 */
@Injectable()
export class AgentsCoordinator {
  private readonly logger = new Logger(AgentsCoordinator.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly routeAgent: RouteAgent,
    private readonly accommodationAgent: AccommodationAgent,
    private readonly fuelAgent: FuelAgent,
    private readonly costAgent: CostAgent,
    private readonly healthAgent: HealthAgent,
    private readonly stopsAgent: StopsAgent,
    private readonly foodAgent: FoodAgent,
    private readonly weatherAgent: WeatherAgent,
  ) {}

  /**
   * Coordinate all agents for comprehensive travel planning
   */
  async coordinateTripPlanning(
    request: TravelRequestDto,
    route: RouteDto,
    costs: TransportCostsDto,
    weather?: { origin: IWeatherData; destination: IWeatherData },
  ): Promise<CoordinatorResponse> {
    this.logger.log('Coordinating multi-agent travel analysis');

    const results: CoordinatorResponse = {
      summary: {
        totalEstimatedCost: costs.totalCost,
        totalTravelTime: route.totalDuration,
        recommendedStops: 0,
        keyRecommendations: [],
      },
    };

    // Run agents in parallel where possible
    const promises: Promise<void>[] = [];

    // Route analysis
    promises.push(
      this.routeAgent
        .analyzeRoute({
          route,
          transportationType: request.transportationType,
          preferences: {},
        })
        .then((result) => {
          if (result.success) {
            results.routeAnalysis = result.data;
          }
        })
        .catch((err) => this.logger.warn(`Route agent failed: ${err.message}`)),
    );

    // Cost analysis
    promises.push(
      this.costAgent
        .analyzeCosts({
          transportationType: request.transportationType,
          distance: route.totalDistance / 1000,
          duration: route.totalDuration / 60,
          passengers: request.passengers || 1,
          fuelCost: costs.fuelCost,
          ticketCost: costs.ticketCost,
        })
        .then((result) => {
          if (result.success) {
            results.costAnalysis = result.data;
            if (result.data.costSavingTips?.length > 0) {
              results.summary.keyRecommendations.push(...result.data.costSavingTips.slice(0, 2));
            }
          }
        })
        .catch((err) => this.logger.warn(`Cost agent failed: ${err.message}`)),
    );

    // Stops recommendations
    promises.push(
      this.stopsAgent
        .recommendStops({
          route: `${request.origin} to ${request.destination}`,
          duration: route.totalDuration / 60,
          transportationType: request.transportationType,
        })
        .then((result) => {
          if (result.success) {
            results.stopsRecommendations = result.data;
            results.summary.recommendedStops = result.data.recommendedStops?.length || 0;
          }
        })
        .catch((err) => this.logger.warn(`Stops agent failed: ${err.message}`)),
    );

    // Food recommendations
    promises.push(
      this.foodAgent
        .recommendFood({
          route: `${request.origin} to ${request.destination}`,
          duration: route.totalDuration / 60,
          passengers: request.passengers || 1,
        })
        .then((result) => {
          if (result.success) {
            results.foodRecommendations = result.data;
          }
        })
        .catch((err) => this.logger.warn(`Food agent failed: ${err.message}`)),
    );

    // Health analysis (for active transport)
    if (['walking', 'bicycle', 'bicycling'].includes(request.transportationType.toLowerCase())) {
      promises.push(
        this.healthAgent
          .analyzeHealth({
            transportationType: request.transportationType,
            distance: route.totalDistance / 1000,
            duration: route.totalDuration / 60,
            passengers: request.passengers || 1,
          })
          .then((result) => {
            if (result.success) {
              results.healthAnalysis = result.data;
            }
          })
          .catch((err) => this.logger.warn(`Health agent failed: ${err.message}`)),
      );
    }

    // Fuel analysis (for motorized transport)
    if (['car', 'motorcycle'].includes(request.transportationType.toLowerCase())) {
      const specs = request.carSpecifications || request.motorcycleSpecifications;
      if (specs) {
        promises.push(
          this.fuelAgent
            .calculateFuel({
              distance: route.totalDistance / 1000,
              fuelType: specs.fuelType,
              fuelConsumption: specs.fuelConsumption,
              tankCapacity: specs.tankCapacity,
              initialFuel: specs.initialFuel,
              route: `${request.origin} to ${request.destination}`,
            })
            .then((result) => {
              if (result.success) {
                results.fuelAnalysis = result.data;
              }
            })
            .catch((err) => this.logger.warn(`Fuel agent failed: ${err.message}`)),
        );
      }
    }

    // Weather analysis (if weather data available)
    if (weather?.origin && weather?.destination) {
      promises.push(
        this.weatherAgent
          .analyzeWeather(weather.origin, weather.destination)
          .then((result) => {
            if (result.success) {
              results.weatherAnalysis = result.data;
              if (result.data.recommendations?.length > 0) {
                results.summary.keyRecommendations.push(...result.data.recommendations.slice(0, 2));
              }
            }
          })
          .catch((err) => this.logger.warn(`Weather agent failed: ${err.message}`)),
      );
    }

    // Wait for all agents to complete
    await Promise.allSettled(promises);

    // Ensure we have at least some key recommendations
    if (results.summary.keyRecommendations.length === 0) {
      results.summary.keyRecommendations = [
        'Take regular breaks every 2 hours',
        'Check weather conditions before departure',
        'Keep emergency contacts handy',
      ];
    }

    return results;
  }

  /**
   * Run a specific agent
   */
  async runAgent(agentName: string, input: any): Promise<any> {
    const agent = this[`${agentName.toLowerCase()}Agent`];
    
    if (!agent) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    return await agent.execute(input);
  }
}
