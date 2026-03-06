import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent, AgentResponse } from './base.agent';

export interface AccommodationInput {
  location: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  budget?: { min: number; max: number };
  preferences?: string[];
}

export interface AccommodationRecommendation {
  type: string;
  recommendations: string[];
  estimatedCost: number;
  bookingTips: string[];
}

/**
 * Accommodation Agent - Provides accommodation recommendations
 */
@Injectable()
export class AccommodationAgent extends BaseAgent {
  constructor(protected readonly configService: ConfigService) {
    super(configService, 'gpt-3.5-turbo', 0.7);
  }

  protected getPromptTemplate(): string {
    return `
You are an expert accommodation recommendation assistant for travel planning.

Provide accommodation recommendations based on:
- Location: {location}
- Check-in: {checkIn}
- Check-out: {checkOut}
- Guests: {guests}
- Budget Range: {budgetMin} - {budgetMax} USD
- Preferences: {preferences}

Provide your recommendations in JSON format with these fields:
- type: recommended accommodation type (hotel, hostel, Airbnb, etc.)
- recommendations: array of 3-5 specific accommodation suggestions or areas to stay
- estimatedCost: estimated total cost in USD
- bookingTips: array of 3-5 tips for booking accommodation

Accommodation Analysis:
`;
  }

  /**
   * Get accommodation recommendations
   */
  async getRecommendations(input: AccommodationInput): Promise<AgentResponse<AccommodationRecommendation>> {
    try {
      const result = await this.executeAndParseJSON({
        location: input.location,
        checkIn: input.checkIn.toISOString(),
        checkOut: input.checkOut.toISOString(),
        guests: input.guests,
        budgetMin: input.budget?.min || 50,
        budgetMax: input.budget?.max || 200,
        preferences: input.preferences?.join(', ') || 'none',
      });

      return {
        success: true,
        data: result,
        metadata: {
          agentName: 'Accommodation',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Accommodation recommendation error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
