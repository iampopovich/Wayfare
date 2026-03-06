import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent, AgentResponse } from './base.agent';

export interface HealthInput {
  transportationType: string;
  distance: number; // km
  duration: number; // hours
  passengers: number;
  weather?: any;
}

export interface HealthAnalysisResult {
  totalCalories: number;
  activityBreakdown: Record<string, number>;
  healthBenefits: string[];
  healthWarnings: string[];
  hydrationRecommendations: string[];
}

/**
 * Health Agent - Analyzes health impact and provides recommendations
 */
@Injectable()
export class HealthAgent extends BaseAgent {
  // Calories burned per km by activity type
  private readonly CALORIES_PER_KM = {
    walking: 50,
    bicycling: 30,
    running: 70,
    hiking: 60,
  };

  constructor(protected readonly configService: ConfigService) {
    super(configService, 'gpt-3.5-turbo', 0.7);
  }

  protected getPromptTemplate(): string {
    return `
You are an expert health and fitness assistant for travel planning.

Analyze health impact for a trip:
- Transportation Type: {transportationType}
- Distance: {distance} km
- Duration: {duration} hours
- Passengers: {passengers}
- Weather Conditions: {weather}

Provide your analysis in JSON format with these fields:
- totalCalories: total calories burned (0 for motorized transport)
- activityBreakdown: object with calories by activity type
- healthBenefits: array of 3-5 health benefits of this travel mode
- healthWarnings: array of any health warnings or precautions
- hydrationRecommendations: array of hydration recommendations

Health Analysis:
`;
  }

  /**
   * Analyze health impact of travel
   */
  async analyzeHealth(input: HealthInput): Promise<AgentResponse<HealthAnalysisResult>> {
    try {
      const transType = input.transportationType.toLowerCase();
      let totalCalories = 0;

      // Calculate calories for active transportation
      if (transType === 'walking') {
        totalCalories = Math.round(this.CALORIES_PER_KM.walking * input.distance * input.passengers);
      } else if (transType === 'bicycling' || transType === 'bicycle') {
        totalCalories = Math.round(this.CALORIES_PER_KM.bicycling * input.distance * input.passengers);
      }

      const result = await this.executeAndParseJSON({
        transportationType: input.transportationType,
        distance: input.distance,
        duration: input.duration,
        passengers: input.passengers,
        weather: input.weather ? JSON.stringify(input.weather) : 'not specified',
        calculatedCalories: totalCalories,
      });

      return {
        success: true,
        data: {
          totalCalories: result.totalCalories || totalCalories,
          activityBreakdown: result.activityBreakdown || { [input.transportationType]: totalCalories },
          healthBenefits: result.healthBenefits || [],
          healthWarnings: result.healthWarnings || [],
          hydrationRecommendations: result.hydrationRecommendations || [],
        },
        metadata: {
          agentName: 'Health',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Health analysis error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
