import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent, AgentResponse } from './base.agent';
import { RouteDto } from '../../models/route/route.dto';

export interface RouteAnalysisInput {
  route: RouteDto;
  transportationType: string;
  preferences?: Record<string, any>;
}

export interface RouteAnalysisResult {
  optimalSpeed: number;
  recommendedBreaks: number[];
  difficulty: string;
  scenicPoints: string[];
  warnings: string[];
}

/**
 * Route Agent - Analyzes routes and provides recommendations
 */
@Injectable()
export class RouteAgent extends BaseAgent {
  constructor(protected readonly configService: ConfigService) {
    super(configService, 'gpt-3.5-turbo', 0.7);
  }

  protected getPromptTemplate(): string {
    return `
You are an expert route analysis assistant for travel planning.

Analyze the following route information and provide recommendations:
- Transportation Type: {transportationType}
- Total Distance: {totalDistance} meters
- Total Duration: {totalDuration} minutes
- Number of Segments: {numSegments}

Provide your analysis in JSON format with these fields:
- optimalSpeed: recommended average speed in km/h
- recommendedBreaks: array of times (in minutes from start) when breaks should be taken
- difficulty: one of "easy", "moderate", "challenging", "difficult"
- scenicPoints: array of recommendations for scenic stops
- warnings: array of any warnings or cautions

Route Analysis:
`;
  }

  /**
   * Analyze a route and provide recommendations
   */
  async analyzeRoute(input: RouteAnalysisInput): Promise<AgentResponse<RouteAnalysisResult>> {
    try {
      const { route, transportationType } = input;

      const result = await this.executeAndParseJSON({
        transportationType,
        totalDistance: route.totalDistance,
        totalDuration: route.totalDuration,
        numSegments: route.segments.length,
      });

      return {
        success: true,
        data: result,
        metadata: {
          agentName: 'Route',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Route analysis error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
