import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent, AgentResponse } from './base.agent';
import { TransportCostsDto } from '../../models/costs/transport-costs.dto';

export interface CostInput {
  transportationType: string;
  distance: number; // km
  duration: number; // hours
  passengers: number;
  fuelCost?: number;
  ticketCost?: number;
  preferences?: Record<string, any>;
}

export interface CostBreakdown {
  totalCost: number;
  costPerPerson: number;
  breakdown: Record<string, number>;
  costSavingTips: string[];
}

/**
 * Cost Agent - Analyzes and optimizes travel costs
 */
@Injectable()
export class CostAgent extends BaseAgent {
  constructor(protected readonly configService: ConfigService) {
    super(configService, 'gpt-3.5-turbo', 0.7);
  }

  protected getPromptTemplate(): string {
    return `
You are an expert travel cost analysis and optimization assistant.

Analyze travel costs for a trip:
- Transportation Type: {transportationType}
- Distance: {distance} km
- Duration: {duration} hours
- Passengers: {passengers}
- Fuel Cost: ${'$'}{fuelCost}
- Ticket Cost: ${'$'}{ticketCost}

Provide your analysis in JSON format with these fields:
- totalCost: total estimated cost in USD
- costPerPerson: cost per person in USD
- breakdown: object with cost categories (fuel, food, water, accommodation, maintenance, tickets, etc.)
- costSavingTips: array of 3-5 tips for reducing travel costs

Cost Analysis:
`;
  }

  /**
   * Analyze travel costs and provide optimization tips
   */
  async analyzeCosts(input: CostInput): Promise<AgentResponse<CostBreakdown>> {
    try {
      const result = await this.executeAndParseJSON({
        transportationType: input.transportationType,
        distance: input.distance,
        duration: input.duration,
        passengers: input.passengers,
        fuelCost: input.fuelCost || 0,
        ticketCost: input.ticketCost || 0,
      });

      return {
        success: true,
        data: result,
        metadata: {
          agentName: 'Cost',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Cost analysis error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Compare costs between different transportation types
   */
  async compareTransportationCosts(
    distance: number,
    duration: number,
    passengers: number,
  ): Promise<AgentResponse<any>> {
    try {
      const prompt = `
Compare travel costs for ${distance} km, ${duration} hours, ${passengers} passengers across:
- Car (gasoline, 7.5L/100km)
- Motorcycle (gasoline, 4L/100km)
- Bus
- Train

Provide a JSON comparison with estimated costs for each mode including fuel/tickets, food, and water.
Format: { car: {...}, motorcycle: {...}, bus: {...}, train: {...}, recommendation: "..." }
`;

      const result = await this.executeAndParseJSON({ prompt });

      return {
        success: true,
        data: result,
        metadata: {
          agentName: 'Cost',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Transportation comparison error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
