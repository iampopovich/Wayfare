import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent, AgentResponse } from './base.agent';

export interface StopsInput {
  route: string;
  duration: number; // hours
  transportationType: string;
  preferences?: string[];
}

export interface StopRecommendation {
  type: string;
  location: string;
  duration: number; // minutes
  facilities: string[];
  reason: string;
}

export interface StopsAnalysisResult {
  recommendedStops: StopRecommendation[];
  restStopInterval: number; // minutes
  totalStopTime: number; // minutes
}

/**
 * Stops Agent - Recommends optimal stops during travel
 */
@Injectable()
export class StopsAgent extends BaseAgent {
  constructor(protected readonly configService: ConfigService) {
    super(configService, 'gpt-3.5-turbo', 0.7);
  }

  protected getPromptTemplate(): string {
    return `
You are an expert travel stops and rest planning assistant.

Recommend optimal stops for a trip:
- Route: {route}
- Duration: {duration} hours
- Transportation Type: {transportationType}
- Preferences: {preferences}

Provide your recommendations in JSON format with these fields:
- recommendedStops: array of stop objects, each with:
  - type: stop type (rest, food, fuel, sightseeing, etc.)
  - location: suggested location or area
  - duration: recommended stop duration in minutes
  - facilities: array of available facilities
  - reason: why this stop is recommended
- restStopInterval: recommended interval between rest stops in minutes
- totalStopTime: estimated total stop time in minutes

Consider:
- Rest stops every 2 hours for driving
- Meal times (breakfast, lunch, dinner)
- Fuel stops for motorized vehicles
- Scenic or interesting points along the route

Stops Analysis:
`;
  }

  /**
   * Recommend optimal stops for a route
   */
  async recommendStops(input: StopsInput): Promise<AgentResponse<StopsAnalysisResult>> {
    try {
      const result = await this.executeAndParseJSON({
        route: input.route,
        duration: input.duration,
        transportationType: input.transportationType,
        preferences: input.preferences?.join(', ') || 'none',
      });

      return {
        success: true,
        data: result,
        metadata: {
          agentName: 'Stops',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Stops recommendation error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Calculate rest stops based on duration
   */
  calculateRestStops(durationHours: number): number {
    // Recommend a rest stop every 2 hours
    const restStopInterval = 2; // hours
    return Math.floor(durationHours / restStopInterval);
  }
}
