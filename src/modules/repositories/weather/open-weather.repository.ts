import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { BaseRepository, ISearchOptions, ISearchResult } from '../base.repository';

export interface IWeatherData {
  location: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  description: string;
  icon: string;
  windSpeed: number;
  windDirection: number;
  visibility: number;
  clouds: number;
  timestamp: Date;
}

export interface IWeatherForecast {
  location: string;
  forecast: IWeatherData[];
}

/**
 * OpenWeatherMap repository for weather data
 */
@Injectable()
export class OpenWeatherRepository extends BaseRepository {
  private readonly httpClient: AxiosInstance;

  constructor(protected readonly configService: ConfigService) {
    super(configService);

    const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');

    if (!apiKey) {
      this.logger.warn('OpenWeather API key not configured');
    }

    this.httpClient = axios.create({
      baseURL: 'https://api.openweathermap.org/data/2.5',
      params: {
        appid: apiKey,
        units: 'metric',
      },
    });
  }

  async getCurrentWeather(
    latitude: number,
    longitude: number,
  ): Promise<IWeatherData> {
    try {
      const response = await this.httpClient.get('/weather', {
        params: {
          lat: latitude,
          lon: longitude,
        },
      });

      return this.transformWeather(response.data);
    } catch (error) {
      this.logger.error(`Weather fetch error: ${error.message}`);
      throw error;
    }
  }

  async getForecast(
    latitude: number,
    longitude: number,
    days: number = 5,
  ): Promise<IWeatherForecast> {
    try {
      const response = await this.httpClient.get('/forecast', {
        params: {
          lat: latitude,
          lon: longitude,
          cnt: days * 8, // API returns data every 3 hours
        },
      });

      const forecast = response.data.list.map((item: any) => 
        this.transformWeather(item, response.data.city?.name),
      );

      return {
        location: response.data.city?.name || 'Unknown',
        forecast,
      };
    } catch (error) {
      this.logger.error(`Weather forecast error: ${error.message}`);
      throw error;
    }
  }

  async search(options: ISearchOptions): Promise<ISearchResult<IWeatherData>> {
    // Weather search by location name
    if (!options.query) {
      return { items: [], totalCount: 0, hasMore: false };
    }

    try {
      const response = await this.httpClient.get('/weather', {
        params: { q: options.query },
      });

      return {
        items: [this.transformWeather(response.data)],
        totalCount: 1,
        hasMore: false,
      };
    } catch (error) {
      this.logger.error(`Weather search error: ${error.message}`);
      return { items: [], totalCount: 0, hasMore: false };
    }
  }

  async getDetails(locationId: string): Promise<IWeatherData> {
    // For weather, locationId is treated as city name
    return this.getCurrentWeatherByCity(locationId);
  }

  async getCurrentWeatherByCity(city: string): Promise<IWeatherData> {
    try {
      const response = await this.httpClient.get('/weather', {
        params: { q: city },
      });

      return this.transformWeather(response.data);
    } catch (error) {
      this.logger.error(`Weather by city error: ${error.message}`);
      throw error;
    }
  }

  private transformWeather(data: any, locationName?: string): IWeatherData {
    return {
      location: locationName || data.name || 'Unknown',
      temperature: data.main.temp,
      feelsLike: data.main.feels_like,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      description: data.weather[0]?.description || 'Unknown',
      icon: data.weather[0]?.icon || '',
      windSpeed: data.wind.speed,
      windDirection: data.wind.deg || 0,
      visibility: data.visibility || 10000,
      clouds: data.clouds.all || 0,
      timestamp: new Date(data.dt * 1000),
    };
  }
}
