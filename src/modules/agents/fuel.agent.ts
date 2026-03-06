import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent, AgentResponse } from './base.agent';

export interface FuelInput {
  distance: number; // km
  fuelType: string;
  fuelConsumption: number; // L/100km
  tankCapacity: number; // liters
  initialFuel: number; // liters
  route?: string;
}

export interface FuelAnalysisResult {
  totalFuelNeeded: number;
  estimatedCost: number;
  refuelingStops: number;
  refuelingLocations: string[];
  fuelEfficiencyTips: string[];
}

/**
 * Fuel Agent - Calculates fuel requirements and costs
 */
@Injectable()
export class FuelAgent extends BaseAgent {
  // Average fuel prices by type (USD per liter)
  private readonly FUEL_PRICES = {
    gasoline: 1.5,
    diesel: 1.4,
    electric: 0.3,
    '92': 1.45,
    '95': 1.5,
    '98': 1.6,
  };

  constructor(protected readonly configService: ConfigService) {
    super(configService, 'gpt-3.5-turbo', 0.7);
  }

  protected getPromptTemplate(): string {
    return `
You are an expert fuel efficiency and cost analysis assistant for travel planning.

Analyze fuel requirements for a trip:
- Distance: {distance} km
- Fuel Type: {fuelType}
- Fuel Consumption: {fuelConsumption} L/100km
- Tank Capacity: {tankCapacity} liters
- Initial Fuel: {initialFuel} liters
- Route: {route}

Provide your analysis in JSON format with these fields:
- totalFuelNeeded: total fuel needed in liters
- estimatedCost: total estimated fuel cost in USD
- refuelingStops: number of refueling stops needed
- refuelingLocations: array of suggested locations for refueling (every ~400km or when tank is low)
- fuelEfficiencyTips: array of 3-5 tips for improving fuel efficiency

Fuel Analysis:
`;
  }

  /**
   * Calculate fuel requirements and costs
   */
  async calculateFuel(input: FuelInput): Promise<AgentResponse<FuelAnalysisResult>> {
    try {
      const fuelPrice = this.FUEL_PRICES[input.fuelType as keyof typeof this.FUEL_PRICES] || 1.5;
      const totalFuelNeeded = (input.fuelConsumption * input.distance) / 100;
      const estimatedCost = totalFuelNeeded * fuelPrice;

      // Calculate refueling stops
      const usableCapacity = input.tankCapacity * 0.9; // 90% to be safe
      const initialRange = (input.initialFuel / input.fuelConsumption) * 100;
      const fullTankRange = (usableCapacity / input.fuelConsumption) * 100;

      let refuelingStops = 0;
      if (input.distance > initialRange) {
        refuelingStops = Math.ceil((input.distance - initialRange) / fullTankRange);
      }

      const result = await this.executeAndParseJSON({
        distance: input.distance,
        fuelType: input.fuelType,
        fuelConsumption: input.fuelConsumption,
        tankCapacity: input.tankCapacity,
        initialFuel: input.initialFuel,
        route: input.route || 'not specified',
        calculatedFuelNeeded: totalFuelNeeded,
        calculatedCost: estimatedCost,
        calculatedStops: refuelingStops,
      });

      return {
        success: true,
        data: {
          totalFuelNeeded: result.totalFuelNeeded || totalFuelNeeded,
          estimatedCost: result.estimatedCost || estimatedCost,
          refuelingStops: result.refuelingStops || refuelingStops,
          refuelingLocations: result.refuelingLocations || [],
          fuelEfficiencyTips: result.fuelEfficiencyTips || [],
        },
        metadata: {
          agentName: 'Fuel',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Fuel calculation error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
