import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseService } from './base.service';
import { OSMRepository } from '../modules/repositories/maps/osm.repository';
import { OpenWeatherRepository } from '../modules/repositories/weather/open-weather.repository';
import { SearchService } from './search.service';
import { TravelRequestDto } from '../models/travel/travel-request.dto';
import { TravelResponseDto } from '../models/travel/travel-response.dto';
import { RouteDto } from '../models/route/route.dto';
import { TransportCostsDto } from '../models/costs/transport-costs.dto';
import { TransportationType } from '../models/travel/transportation-type.enum';
import { IRoute } from '../modules/repositories/maps/base-maps.repository';
import { ILocation } from '../modules/repositories/base.repository';

/**
 * Travel service - main business logic for travel planning
 * Orchestrates route planning, cost calculation, and recommendations
 */
@Injectable()
export class TravelService extends BaseService {
  // Default fuel prices (USD per liter)
  private readonly FUEL_PRICES = {
    gasoline: 1.5,
    diesel: 1.4,
    electric: 0.3, // per kWh equivalent
    '92': 1.45,
    '95': 1.5,
    '98': 1.6,
  };

  // Average food/water costs per person per hour
  private readonly FOOD_COST_PER_HOUR = 5; // USD
  private readonly WATER_COST_PER_HOUR = 2; // USD

  constructor(
    protected readonly configService: ConfigService,
    private readonly mapsRepository: OSMRepository,
    private readonly weatherRepository: OpenWeatherRepository,
    private readonly searchService: SearchService,
  ) {
    super(configService, 'deepseek-reasoner', 0.7);
  }

  /**
   * Plan complete travel itinerary
   */
  async planTravel(request: TravelRequestDto): Promise<TravelResponseDto> {
    try {
      this.logger.log(`Planning travel from ${request.origin} to ${request.destination}`);

      // Step 1: Get route from maps
      const route = await this.getRoute(request);

      // Step 2: Calculate transport costs
      const transportCosts = await this.calculateTransportCosts(request, route);

      // Step 3: Calculate stops if needed
      const stops = await this.calculateStops(request, route);

      // Step 4: Calculate calories for active transport
      const health = await this.calculateCalories(request, route);

      // Step 5: Get weather forecast for the route
      const weather = await this.getWeatherForRoute(route);

      // Step 6: Use AI to generate recommendations
      const recommendations = await this.generateRecommendations(request, route, transportCosts);

      return {
        route: this.convertToRouteDto(route),
        costs: transportCosts,
        stops,
        health,
        weather,
        recommendations,
        metadata: {
          generatedAt: new Date().toISOString(),
          transportationType: request.transportationType,
          passengers: request.passengers || 1,
        },
      };
    } catch (error) {
      this.logger.error(`Travel planning error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get route between origin and destination
   */
  private async getRoute(request: TravelRequestDto): Promise<IRoute> {
    // Geocode origin and destination
    const originLocation = await this.mapsRepository.geocode(request.origin);
    const destLocation = await this.mapsRepository.geocode(request.destination);

    // Determine mode based on transportation type
    const mode = this.getTravelMode(request.transportationType);

    // Get directions
    return await this.mapsRepository.getDirections(
      originLocation,
      destLocation,
      mode,
    );
  }

  /**
   * Calculate transport costs based on route and vehicle
   */
  async calculateTransportCosts(
    request: TravelRequestDto,
    route: IRoute,
  ): Promise<TransportCostsDto> {
    const distanceKm = route.totalDistance / 1000;
    const durationHours = route.totalDuration / 60;
    const passengers = request.passengers || 1;

    const costs = new TransportCostsDto();
    costs.currency = 'USD';

    switch (request.transportationType) {
      case TransportationType.CAR:
        return this.calculateCarCosts(request, distanceKm, durationHours, passengers);
      
      case TransportationType.MOTORCYCLE:
        return this.calculateMotorcycleCosts(request, distanceKm, durationHours, passengers);
      
      case TransportationType.BUS:
        costs.totalCost = 30 * passengers; // Estimated bus ticket
        costs.ticketCost = 30 * passengers;
        costs.foodCost = this.FOOD_COST_PER_HOUR * durationHours * passengers;
        costs.waterCost = this.WATER_COST_PER_HOUR * durationHours * passengers;
        break;

      case TransportationType.TRAIN:
        costs.totalCost = 50 * passengers; // Estimated train ticket
        costs.ticketCost = 50 * passengers;
        costs.foodCost = this.FOOD_COST_PER_HOUR * durationHours * passengers;
        costs.waterCost = this.WATER_COST_PER_HOUR * durationHours * passengers;
        break;

      case TransportationType.WALKING:
      case TransportationType.BICYCLE:
        costs.totalCost = 0;
        costs.foodCost = this.FOOD_COST_PER_HOUR * durationHours * passengers;
        costs.waterCost = this.WATER_COST_PER_HOUR * durationHours * passengers;
        break;

      default:
        costs.totalCost = 0;
    }

    // Add food and water if not already calculated
    if (!costs.foodCost) {
      costs.foodCost = this.FOOD_COST_PER_HOUR * durationHours * passengers;
    }
    if (!costs.waterCost) {
      costs.waterCost = this.WATER_COST_PER_HOUR * durationHours * passengers;
    }

    costs.totalCost += (costs.foodCost || 0) + (costs.waterCost || 0);

    return costs;
  }

  /**
   * Calculate car-specific costs
   */
  private async calculateCarCosts(
    request: TravelRequestDto,
    distanceKm: number,
    durationHours: number,
    passengers: number,
  ): Promise<TransportCostsDto> {
    const specs = request.carSpecifications || {
      fuelConsumption: 7.5,
      fuelType: 'gasoline',
      tankCapacity: 60,
      initialFuel: 60,
    };

    const fuelConsumption = specs.fuelConsumption || 7.5;
    const fuelType = specs.fuelType || 'gasoline';
    const tankCapacity = specs.tankCapacity || 60;
    const initialFuel = specs.initialFuel || tankCapacity;

    const fuelNeeded = (fuelConsumption * distanceKm) / 100;
    const fuelPrice = this.FUEL_PRICES[fuelType as keyof typeof this.FUEL_PRICES] || 1.5;
    const fuelCost = fuelNeeded * fuelPrice;

    // Calculate refueling stops needed
    const fuelPerTank = tankCapacity;
    const fuelAfterTrip = initialFuel - fuelNeeded;
    const refuelingStops = fuelNeeded > initialFuel ? Math.ceil((fuelNeeded - initialFuel) / fuelPerTank) : 0;

    // Maintenance cost estimate (oil, wear) ~ $0.05 per km
    const maintenanceCost = distanceKm * 0.05;

    const costs = new TransportCostsDto();
    costs.currency = 'USD';
    costs.fuelCost = fuelCost;
    costs.foodCost = this.FOOD_COST_PER_HOUR * durationHours * passengers;
    costs.waterCost = this.WATER_COST_PER_HOUR * durationHours * passengers;
    costs.maintenanceCost = maintenanceCost;
    costs.refuelingStops = refuelingStops;
    costs.totalCost = fuelCost + maintenanceCost + costs.foodCost + costs.waterCost;

    return costs;
  }

  /**
   * Calculate motorcycle-specific costs
   */
  private async calculateMotorcycleCosts(
    request: TravelRequestDto,
    distanceKm: number,
    durationHours: number,
    passengers: number,
  ): Promise<TransportCostsDto> {
    const specs = request.motorcycleSpecifications || {
      fuelConsumption: 4.0, // L/100km
      fuelType: 'gasoline',
      tankCapacity: 15,
      initialFuel: 15,
    };

    const fuelNeeded = (specs.fuelConsumption * distanceKm) / 100;
    const fuelPrice = this.FUEL_PRICES[specs.fuelType as keyof typeof this.FUEL_PRICES] || 1.5;
    const fuelCost = fuelNeeded * fuelPrice;

    // Calculate refueling stops needed
    const fuelPerTank = specs.tankCapacity;
    const initialFuel = specs.initialFuel || specs.tankCapacity;
    const refuelingStops = fuelNeeded > initialFuel ? Math.ceil((fuelNeeded - initialFuel) / fuelPerTank) : 0;

    // Maintenance cost estimate ~ $0.03 per km
    const maintenanceCost = distanceKm * 0.03;

    const costs = new TransportCostsDto();
    costs.currency = 'USD';
    costs.fuelCost = fuelCost;
    costs.foodCost = this.FOOD_COST_PER_HOUR * durationHours * passengers;
    costs.waterCost = this.WATER_COST_PER_HOUR * durationHours * passengers;
    costs.maintenanceCost = maintenanceCost;
    costs.refuelingStops = refuelingStops;
    costs.totalCost = fuelCost + maintenanceCost + costs.foodCost + costs.waterCost;

    return costs;
  }

  /**
   * Calculate recommended stops for the route based on segments
   */
  private async calculateStops(
    request: TravelRequestDto,
    route: IRoute,
  ): Promise<any[]> {
    const stops = [];
    const distanceKm = route.totalDistance / 1000;
    const durationHours = route.totalDuration / 60;

    // Calculate fuel stops based on vehicle type and tank capacity
    let fuelStopInterval = 500; // km, default
    if (request.transportationType === TransportationType.CAR && request.carSpecifications) {
      const tankCapacity = request.carSpecifications.tankCapacity || 60;
      const fuelConsumption = request.carSpecifications.fuelConsumption || 8;
      fuelStopInterval = Math.floor((tankCapacity / fuelConsumption) * 100);
    } else if (request.transportationType === TransportationType.MOTORCYCLE && request.motorcycleSpecifications) {
      const tankCapacity = request.motorcycleSpecifications.tankCapacity || 15;
      const fuelConsumption = request.motorcycleSpecifications.fuelConsumption || 5;
      fuelStopInterval = Math.floor((tankCapacity / fuelConsumption) * 100);
    }

    // Calculate rest stops (every 2-3 hours or 200km)
    const restStopIntervalHours = 2.5;
    const restStopIntervalKm = 200;

    let accumulatedDistance = 0;
    let accumulatedTime = 0;
    let distanceSinceLastFuelStop = 0;
    let timeSinceLastRestStop = 0;

    for (const segment of route.segments) {
      accumulatedDistance += segment.distance;
      accumulatedTime += segment.duration;
      distanceSinceLastFuelStop += segment.distance;
      timeSinceLastRestStop += segment.duration;

      const accumulatedDistanceKm = accumulatedDistance / 1000;
      const distanceSinceFuelKm = distanceSinceLastFuelStop / 1000;
      const timeSinceRestHours = timeSinceLastRestStop / 60;

      // Check for fuel stop needed
      if (distanceSinceFuelKm >= fuelStopInterval && 
          (request.transportationType === TransportationType.CAR || 
           request.transportationType === TransportationType.MOTORCYCLE)) {
        
        const gasStations = await this.searchService.searchPlaces({
          query: 'gas station',
          latitude: segment.endLocation.latitude,
          longitude: segment.endLocation.longitude,
          radius: 3000,
        });

        if (gasStations.results.length > 0) {
          stops.push({
            type: 'fuel',
            location: {
              latitude: segment.endLocation.latitude,
              longitude: segment.endLocation.longitude,
              address: segment.endLocation.address,
            },
            distanceFromStart: accumulatedDistanceKm.toFixed(1),
            estimatedTime: this.formatTime(accumulatedTime),
            placeDetails: gasStations.results[0],
          });
          distanceSinceLastFuelStop = 0;
        }
      }

      // Check for rest stop needed
      if (timeSinceRestHours >= restStopIntervalHours) {
        const restAreas = await this.searchService.searchPlaces({
          query: 'rest area',
          latitude: segment.endLocation.latitude,
          longitude: segment.endLocation.longitude,
          radius: 2000,
        });

        if (restAreas.results.length > 0) {
          stops.push({
            type: 'rest',
            location: {
              latitude: segment.endLocation.latitude,
              longitude: segment.endLocation.longitude,
              address: segment.endLocation.address,
            },
            distanceFromStart: accumulatedDistanceKm.toFixed(1),
            estimatedTime: this.formatTime(accumulatedTime),
            duration: 20,
            placeDetails: restAreas.results[0],
          });
          timeSinceLastRestStop = 0;
        }
      }
    }

    // Add food stops near major cities (every 4-5 hours)
    const foodInterval = 4.5;
    const numFoodStops = Math.floor(durationHours / foodInterval);
    
    for (let i = 1; i <= numFoodStops; i++) {
      const targetTime = (durationHours * i / numFoodStops) * 60;
      let currentTime = 0;
      
      for (const segment of route.segments) {
        currentTime += segment.duration;
        if (currentTime >= targetTime) {
          const restaurants = await this.searchService.searchPlaces({
            query: 'restaurant',
            latitude: segment.endLocation.latitude,
            longitude: segment.endLocation.longitude,
            radius: 5000,
          });

          if (restaurants.results.length > 0) {
            stops.push({
              type: 'food',
              location: {
                latitude: segment.endLocation.latitude,
                longitude: segment.endLocation.longitude,
                address: segment.endLocation.address,
              },
              distanceFromStart: (segment.distance / 1000).toFixed(1),
              estimatedTime: this.formatTime(currentTime),
              placeDetails: restaurants.results[0],
            });
          }
          break;
        }
      }
    }

    // Sort stops by distance from start
    stops.sort((a, b) => parseFloat(a.distanceFromStart) - parseFloat(b.distanceFromStart));

    return stops;
  }

  /**
   * Format minutes to HH:MM
   */
  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate calorie burn for active transportation
   */
  private async calculateCalories(
    request: TravelRequestDto,
    route: IRoute,
  ): Promise<any> {
    const distanceKm = route.totalDistance / 1000;
    const passengers = request.passengers || 1;

    let caloriesPerKm = 0;

    switch (request.transportationType) {
      case TransportationType.WALKING:
        caloriesPerKm = 50; // calories per km walking
        break;
      case TransportationType.BICYCLE:
        caloriesPerKm = 30; // calories per km cycling
        break;
      default:
        return {
          totalCalories: 0,
          activityBreakdown: {},
        };
    }

    const totalCalories = Math.round(caloriesPerKm * distanceKm * passengers);

    return {
      totalCalories,
      activityBreakdown: {
        [request.transportationType]: totalCalories,
      },
    };
  }

  /**
   * Get weather forecast for the route
   */
  private async getWeatherForRoute(route: IRoute): Promise<any> {
    try {
      // Get weather for start and end points
      if (route.segments.length > 0) {
        const startSegment = route.segments[0];
        const endSegment = route.segments[route.segments.length - 1];

        const [startWeather, endWeather] = await Promise.all([
          this.weatherRepository.getCurrentWeather(
            startSegment.startLocation.latitude,
            startSegment.startLocation.longitude,
          ),
          this.weatherRepository.getCurrentWeather(
            endSegment.endLocation.latitude,
            endSegment.endLocation.longitude,
          ),
        ]);

        return {
          origin: startWeather,
          destination: endWeather,
        };
      }
    } catch (error) {
      this.logger.warn(`Weather fetch failed: ${error.message}`);
    }

    return null;
  }

  /**
   * Generate AI-powered recommendations for the trip with specific route points
   */
  private async generateRecommendations(
    request: TravelRequestDto,
    route: IRoute,
    costs: TransportCostsDto,
  ): Promise<string[]> {
    try {
      const distanceKm = route.totalDistance / 1000;
      const durationHours = route.totalDuration / 60;

      // Build route waypoints summary - include origin and all segment points
      const waypoints: string[] = [];
      waypoints.push(`Origin: ${request.origin}`);
      
      // Add intermediate waypoints from path points (sample every 100km)
      const pathPoints = route.pathPoints;
      const sampleInterval = Math.max(1, Math.floor(pathPoints.length / 10));
      
      for (let i = sampleInterval; i < pathPoints.length - 1; i += sampleInterval) {
        const [lat, lon] = pathPoints[i];
        waypoints.push(`Via: (${lat.toFixed(2)}, ${lon.toFixed(2)})`);
      }
      
      waypoints.push(`Destination: ${request.destination}`);

      // Build vehicle info
      let vehicleInfo = '';
      if (request.transportationType === TransportationType.CAR && request.carSpecifications) {
        const specs = request.carSpecifications;
        vehicleInfo = `
        Vehicle: Car (${specs.model || 'N/A'})
        Fuel type: ${specs.fuelType || 'gasoline'}
        Fuel consumption: ${specs.fuelConsumption || 8} L/100km
        Tank capacity: ${specs.tankCapacity || 60} L
        Initial fuel: ${specs.initialFuel || specs.tankCapacity || 60} L
        `;
      } else if (request.transportationType === TransportationType.MOTORCYCLE && request.motorcycleSpecifications) {
        const specs = request.motorcycleSpecifications;
        vehicleInfo = `
        Vehicle: Motorcycle (${specs.model || 'N/A'})
        Fuel type: ${specs.fuelType || 'gasoline'}
        Fuel consumption: ${specs.fuelConsumption || 5} L/100km
        Tank capacity: ${specs.tankCapacity || 15} L
        Initial fuel: ${specs.initialFuel || specs.tankCapacity || 15} L
        `;
      }

      const prompt = `
        Analyze this specific route and provide 3-5 practical recommendations:
        
        Route: ${request.origin} → ${request.destination}
        Transportation: ${request.transportationType}
        Total distance: ${distanceKm.toFixed(0)} km
        Total duration: ${durationHours.toFixed(1)} hours
        Estimated cost: $${costs.totalCost.toFixed(2)}
        Passengers: ${request.passengers || 1}
        Vehicle info : ${vehicleInfo}
        
        Route path:
        ${waypoints.join('\n')}
        
        Provide specific recommendations for:
        - Where to stop (reference actual cities/points along the route)
        - When to refuel (calculate based on fuel consumption and tank capacity)
        - Safety considerations for this specific route
        
        Format as a JSON array of strings.
      `;

      const response = await this.executeAndParseJSON(prompt);
      return Array.isArray(response) ? response : [];
    } catch (error) {
      this.logger.warn(`Recommendations generation failed: ${error.message}`);
      return [
        'Take regular breaks every 2 hours',
        'Check weather conditions before departure',
        'Keep emergency contacts handy',
      ];
    }
  }

  /**
   * Get travel mode string for maps API
   * OSRM supports: car, bike, foot
   */
  private getTravelMode(transportType: TransportationType): string {
    const modeMap: Record<TransportationType, string> = {
      [TransportationType.CAR]: 'car',
      [TransportationType.MOTORCYCLE]: 'car',
      [TransportationType.BUS]: 'car',
      [TransportationType.TRAIN]: 'car', // No transit in OSRM, use car as fallback
      [TransportationType.WALKING]: 'foot',
      [TransportationType.BICYCLE]: 'bike',
      [TransportationType.FERRY]: 'car',
      [TransportationType.PLANE]: 'car', // Not supported, use car as fallback
    };

    return modeMap[transportType] || 'car';
  }

  /**
   * Convert IRoute to RouteDto for response
   */
  private convertToRouteDto(route: IRoute): RouteDto {
    return {
      segments: route.segments.map((segment) => ({
        startLocation: {
          latitude: segment.startLocation.latitude,
          longitude: segment.startLocation.longitude,
          address: segment.startLocation.address || '',
          placeId: segment.startLocation.placeId || '',
        },
        endLocation: {
          latitude: segment.endLocation.latitude,
          longitude: segment.endLocation.longitude,
          address: segment.endLocation.address || '',
          placeId: segment.endLocation.placeId || '',
        },
        distance: segment.distance,
        duration: segment.duration,
        polyline: segment.polyline,
        instructions: segment.instructions,
      })),
      totalDistance: route.totalDistance,
      totalDuration: route.totalDuration,
      pathPoints: route.pathPoints,
    };
  }
}
