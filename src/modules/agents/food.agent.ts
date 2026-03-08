import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent, AgentResponse } from './base.agent';

export interface FoodInput {
  route: string;
  duration: number; // hours
  passengers: number;
  dietaryRestrictions?: string[];
  preferences?: string[];
  budget?: { min: number; max: number };
}

export interface FoodRecommendation {
  type: string;
  name: string;
  location: string;
  estimatedCost: number;
  cuisine: string;
  rating?: number;
}

export interface FoodAnalysisResult {
  recommendedStops: FoodRecommendation[];
  totalFoodBudget: number;
  waterRequirements: number; // liters
  foodTips: string[];
}

/**
 * Food Agent - Recommends food stops and calculates food requirements
 */
@Injectable()
export class FoodAgent extends BaseAgent {
  // Average food cost per person per meal (USD)
  private readonly FOOD_COSTS = {
    budget: 10,
    moderate: 25,
    premium: 50,
  };

  // Water requirement per person per hour (liters)
  private readonly WATER_PER_HOUR = 0.5;

  constructor(protected readonly configService: ConfigService) {
    super(configService, 'gpt-3.5-turbo', 0.7);
  }

  protected getPromptTemplate(): string {
    return `
You are an expert food and dining recommendation assistant for travel planning.

Recommend food options for a trip:
- Route: {route}
- Duration: {duration} hours
- Passengers: {passengers}
- Dietary Restrictions: {dietaryRestrictions}
- Preferences: {preferences}
- Budget Range: ${'$'}{budgetMin} - ${'$'}{budgetMax} per person

Provide your recommendations in JSON format with these fields:
- recommendedStops: array of 3-5 food stop recommendations, each with:
  - type: meal type (breakfast, lunch, dinner, snack)
  - name: suggested restaurant or food type
  - location: general location along the route
  - estimatedCost: estimated cost per person in USD
  - cuisine: type of cuisine
  - rating: expected rating (1-5)
- totalFoodBudget: total estimated food budget for all passengers in USD
- waterRequirements: total water needed in liters
- foodTips: array of 3-5 food and dining tips for this trip

Food Analysis:
`;
  }

  /**
   * Get food recommendations for a trip
   */
  async recommendFood(input: FoodInput): Promise<AgentResponse<FoodAnalysisResult>> {
    try {
      const numMeals = Math.ceil(input.duration / 4); // Assume meal every 4 hours
      const budgetPerPerson = input.budget?.max || this.FOOD_COSTS.moderate;
      const totalFoodBudget = numMeals * budgetPerPerson * input.passengers;
      const waterRequirements = Math.round(input.duration * this.WATER_PER_HOUR * input.passengers);

      const result = await this.executeAndParseJSON({
        route: input.route,
        duration: input.duration,
        passengers: input.passengers,
        dietaryRestrictions: input.dietaryRestrictions?.join(', ') || 'none',
        preferences: input.preferences?.join(', ') || 'none',
        budgetMin: input.budget?.min || 10,
        budgetMax: input.budget?.max || 50,
        calculatedBudget: totalFoodBudget,
        calculatedWater: waterRequirements,
      });

      return {
        success: true,
        data: {
          recommendedStops: result.recommendedStops || [],
          totalFoodBudget: result.totalFoodBudget || totalFoodBudget,
          waterRequirements: result.waterRequirements || waterRequirements,
          foodTips: result.foodTips || [],
        },
        metadata: {
          agentName: 'Food',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Food recommendation error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Calculate food and water requirements
   */
  calculateRequirements(durationHours: number, passengers: number): {
    foodCost: number;
    waterCost: number;
    waterLiters: number;
  } {
    const numMeals = Math.ceil(durationHours / 4);
    const foodCost = numMeals * this.FOOD_COSTS.moderate * passengers;
    const waterLiters = durationHours * this.WATER_PER_HOUR * passengers;
    const waterCost = waterLiters * 2; // ~$2 per liter bottled water

    return {
      foodCost,
      waterCost,
      waterLiters: Math.round(waterLiters),
    };
  }
}
