import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent, AgentResponse } from './base.agent';
import { IWeatherData } from '../repositories/weather/open-weather.repository';

export interface WeatherInput {
  origin: string;
  destination: string;
  date: Date;
  activities?: string[];
}

export interface WeatherAnalysisResult {
  summary: string;
  originWeather: IWeatherData;
  destinationWeather: IWeatherData;
  travelConditions: string;
  recommendations: string[];
  warnings: string[];
  packingList: string[];
}

/**
 * Weather Agent - Analyzes weather conditions and provides recommendations
 */
@Injectable()
export class WeatherAgent extends BaseAgent {
  constructor(protected readonly configService: ConfigService) {
    super(configService, 'gpt-3.5-turbo', 0.7);
  }

  protected getPromptTemplate(): string {
    return `
You are an expert weather analysis and travel recommendation assistant.

Analyze weather conditions for a trip:
- Origin: {origin}
- Destination: {destination}
- Travel Date: {date}
- Planned Activities: {activities}
- Origin Weather: {originWeather}
- Destination Weather: {destinationWeather}

Provide your analysis in JSON format with these fields:
- summary: brief 1-2 sentence weather summary
- travelConditions: assessment of travel conditions (excellent, good, fair, poor)
- recommendations: array of 3-5 weather-based recommendations
- warnings: array of any weather warnings or cautions
- packingList: array of 5-10 items to pack based on weather conditions

Consider:
- Temperature and precipitation
- Wind conditions for motorcycles/cyclists
- Visibility for drivers
- UV index and sun protection
- Seasonal considerations

Weather Analysis:
`;
  }

  /**
   * Analyze weather conditions and provide recommendations
   */
  async analyzeWeather(
    originWeather: IWeatherData,
    destinationWeather: IWeatherData,
    activities?: string[],
  ): Promise<AgentResponse<WeatherAnalysisResult>> {
    try {
      const result = await this.executeAndParseJSON({
        origin: originWeather.location,
        destination: destinationWeather.location,
        date: new Date().toISOString(),
        activities: activities?.join(', ') || 'general travel',
        originWeather: JSON.stringify(originWeather),
        destinationWeather: JSON.stringify(destinationWeather),
      });

      return {
        success: true,
        data: {
          summary: result.summary || 'Weather conditions are typical for this route',
          originWeather,
          destinationWeather,
          travelConditions: result.travelConditions || 'good',
          recommendations: result.recommendations || [],
          warnings: result.warnings || [],
          packingList: result.packingList || [],
        },
        metadata: {
          agentName: 'Weather',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Weather analysis error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        data: {
          summary: 'Unable to analyze weather conditions',
          originWeather,
          destinationWeather,
          travelConditions: 'unknown',
          recommendations: ['Check weather forecast before departure'],
          warnings: ['Weather analysis unavailable'],
          packingList: [],
        },
      };
    }
  }

  /**
   * Get weather-based travel recommendations
   */
  async getRecommendations(weather: IWeatherData): Promise<AgentResponse<string[]>> {
    try {
      const prompt = `
Provide 3-5 brief travel recommendations based on these weather conditions:
- Temperature: ${weather.temperature}°C
- Conditions: ${weather.description}
- Wind: ${weather.windSpeed} m/s
- Humidity: ${weather.humidity}%

Return as JSON array of strings.
`;

      const result = await this.executeAndParseJSON({ prompt });

      return {
        success: true,
        data: result || [],
        metadata: {
          agentName: 'Weather',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Weather recommendations error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
