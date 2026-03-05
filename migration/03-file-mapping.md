# File-by-File Migration Mapping

## Overview

This document provides a detailed mapping of each Python file to its JavaScript/TypeScript equivalent, including specific migration notes and code examples.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Direct translation |
| ⚠️ | Requires adaptation |
| 🔧 | Significant changes needed |
| 🗑️ | Can be removed/replaced |

---

## 1. Entry Point & Configuration

### 1.1 `wayfare/main.py` → `src/main.ts`

| Aspect | Python (FastAPI) | TypeScript (NestJS) |
|--------|------------------|---------------------|
| Framework | FastAPI | NestJS |
| Server | uvicorn | NestJS HTTP Adapter |
| Middleware | `@app.middleware` | Express middleware / NestJS interceptors |
| Static files | `StaticFiles` | `@nestjs/serve-static` |
| CORS | `CORSMiddleware` | `app.enableCors()` |
| Exception handling | `@app.exception_handler` | Exception Filters |

**Migration Notes:**
- ⚠️ Middleware needs to be converted to NestJS middleware or interceptors
- ✅ CORS setup is similar
- ✅ Static file serving via `@nestjs/serve-static`
- 🔧 Exception handling via NestJS filters

**Code Example:**
```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global API prefix
  app.setGlobalPrefix('api/v1');
  
  // CORS configuration
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  // Request logging middleware
  app.use((req, res, next) => {
    const startTime = Date.now();
    Logger.log(`Request: ${req.method} ${req.path}`);
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      Logger.log(`Response: ${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms`);
    });
    
    next();
  });
  
  // Static files
  // Configured in AppModule via ServeStaticModule
  
  // Swagger documentation
  setupSwagger(app);
  
  // Global exception filters
  // app.useGlobalFilters(new GlobalExceptionFilter());
  
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';
  
  await app.listen(port, host);
  Logger.log(`Application running on: http://${host}:${port}`, 'Bootstrap');
}

bootstrap();
```

---

### 1.2 `wayfare/__init__.py` → `src/index.ts` (optional)

| Aspect | Python | TypeScript |
|--------|--------|------------|
| Version | `__version__` | `package.json` version |
| Package info | Module docstring | README.md |

**Migration Notes:**
- 🗑️ No direct equivalent needed - version in package.json

---

### 1.3 `wayfare/core/settings.py` → `src/config/`

**Files Created:**
- `src/config/index.ts` - Config exports
- `src/config/app.config.ts` - App settings
- `src/config/openai.config.ts` - OpenAI settings
- `src/config/maps.config.ts` - Maps API config
- `src/config/travel.config.ts` - Travel API config
- `src/config/config.validation.ts` - Validation schema

**Migration Notes:**
- ⚠️ Pydantic Settings → `@nestjs/config` with validation
- ✅ Environment variable loading similar
- ⚠️ Validator decorators replace Pydantic validators

**Code Example:**
```typescript
// src/config/app.config.ts
import { registerAs } from '@nestjs/config';
import { IsString, IsInt, IsOptional, IsArray } from 'class-validator';

export class AppConfig {
  @IsString()
  @IsOptional()
  HOST: string = '0.0.0.0';

  @IsInt()
  @IsOptional()
  PORT: number = 3000;

  @IsArray()
  @IsOptional()
  ALLOWED_ORIGINS: string[] = ['*'];

  @IsString()
  @IsOptional()
  ENVIRONMENT: string = 'development';
}

export default registerAs('app', () => ({
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT, 10) || 3000,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  environment: process.env.NODE_ENV || 'development',
}));
```

```typescript
// src/config/config.validation.ts
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';

export function validate(config: Record<string, any>) {
  const validatedConfig = plainToClass(AppConfig, config, {
    enableImplicitConversion: true,
  });
  
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });
  
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  
  return validatedConfig;
}
```

---

### 1.4 `wayfare/core/logging.py` → `src/common/utils/logger.ts`

**Migration Notes:**
- ⚠️ Python logging → `winston` or `pino`
- ✅ Similar log levels and format

**Code Example:**
```typescript
// src/common/utils/logger.ts
import * as winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} - ${level}: ${message}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
```

---

## 2. Models Layer

### 2.1 `wayfare/models/base.py` → `src/models/base/`

| Python Class | TypeScript DTO | Status |
|--------------|----------------|--------|
| `GeoLocation` | `GeoLocationDto` | ✅ |
| `PriceRange` | `PriceRangeDto` | ✅ |
| `PlaceDetails` | `PlaceDetailsDto` | ✅ |
| `Accommodation` | `AccommodationDto` | ✅ |
| `SearchResult` | `SearchResultDto` | ✅ |

**Code Example:**
```typescript
// src/models/base/geo-location.dto.ts
import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GeoLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsString()
  @IsOptional()
  address?: string;
}
```

```typescript
// src/models/base/place-details.dto.ts
import { IsString, IsNumber, IsOptional, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GeoLocationDto } from './geo-location.dto';

export class PlaceDetailsDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @ValidateNested()
  @Type(() => GeoLocationDto)
  location: GeoLocationDto;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  rating?: number;

  @IsNumber()
  @IsOptional()
  reviewsCount?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
```

---

### 2.2 `wayfare/models/location.py` → `src/models/location/location.dto.ts`

```typescript
// src/models/location/location.dto.ts
import { IsString, IsNumber, Min, Max } from 'class-validator';

export class LocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsString()
  address: string;

  @IsString()
  placeId: string;
}
```

---

### 2.3 `wayfare/models/route.py` → `src/models/route/`

| Python Class | TypeScript DTO | Status |
|--------------|----------------|--------|
| `RouteSegment` | `RouteSegmentDto` | ✅ |
| `Route` | `RouteDto` | ✅ |

```typescript
// src/models/route/route-segment.dto.ts
import { IsNumber, IsString, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto } from '../location/location.dto';

export class RouteSegmentDto {
  @ValidateNested()
  @Type(() => LocationDto)
  startLocation: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  endLocation: LocationDto;

  @IsNumber()
  distance: number; // meters

  @IsNumber()
  duration: number; // minutes

  @IsString()
  polyline: string;

  @IsArray()
  @IsString({ each: true })
  instructions: string[];
}
```

```typescript
// src/models/route/route.dto.ts
import { IsNumber, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { RouteSegmentDto } from './route-segment.dto';

export class RouteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteSegmentDto)
  segments: RouteSegmentDto[];

  @IsNumber()
  totalDistance: number; // meters

  @IsNumber()
  totalDuration: number; // minutes

  @IsArray()
  @IsArray({ each: true })
  pathPoints: number[][]; // [[lat, lng], ...]
}
```

---

### 2.4 `wayfare/models/travel.py` → `src/models/travel/`

| Python Class | TypeScript DTO | Status |
|--------------|----------------|--------|
| `TransportationType` | `TransportationType` (enum) | ✅ |
| `BudgetRange` | `BudgetRangeDto` | ✅ |
| `OvernightStay` | `OvernightStayDto` | ✅ |
| `TravelRequest` | `TravelRequestDto` | ✅ |
| `TravelResponse` | `TravelResponseDto` | ✅ |

```typescript
// src/models/travel/transportation-type.enum.ts
export enum TransportationType {
  CAR = 'car',
  MOTORCYCLE = 'motorcycle',
  BUS = 'bus',
  TRAIN = 'train',
  WALKING = 'walking',
  BICYCLE = 'bicycle',
  FERRY = 'ferry',
  PLANE = 'plane',
}
```

```typescript
// src/models/travel/travel-request.dto.ts
import { 
  IsString, IsEnum, IsOptional, IsInt, Min, Max, 
  ValidateNested, IsBoolean 
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransportationType } from './transportation-type.enum';
import { CarSpecificationsDto } from '../vehicle/car-specifications.dto';
import { MotorcycleSpecificationsDto } from '../vehicle/motorcycle-specifications.dto';
import { BudgetRangeDto } from './budget-range.dto';
import { OvernightStayDto } from './overnight-stay.dto';

export class TravelRequestDto {
  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsEnum(TransportationType)
  transportationType: TransportationType;

  @IsOptional()
  @ValidateNested()
  @Type(() => CarSpecificationsDto)
  carSpecifications?: CarSpecificationsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MotorcycleSpecificationsDto)
  motorcycleSpecifications?: MotorcycleSpecificationsDto;

  @IsBoolean()
  @IsOptional()
  preferDirectRoutes?: boolean = true;

  @IsInt()
  @IsOptional()
  maxTransfers?: number;

  @IsInt()
  @Min(1)
  @Max(10)
  passengers: number = 1;

  @IsOptional()
  @ValidateNested()
  @Type(() => BudgetRangeDto)
  budget?: BudgetRangeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OvernightStayDto)
  overnightStay?: OvernightStayDto;
}
```

---

### 2.5 `wayfare/models/costs.py` → `src/models/costs/`

```typescript
// src/models/costs/cost.dto.ts
import { IsNumber, IsString, IsObject } from 'class-validator';

export class CostDto {
  @IsNumber()
  totalAmount: number;

  @IsString()
  currency: string = 'USD';

  @IsObject()
  breakdown: Record<string, number>;
}
```

```typescript
// src/models/costs/transport-costs.dto.ts
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class TransportCostsDto {
  @IsNumber()
  totalCost: number;

  @IsString()
  currency: string = 'USD';

  @IsNumber()
  @IsOptional()
  fuelCost?: number;

  @IsNumber()
  @IsOptional()
  ticketCost?: number;

  @IsNumber()
  @IsOptional()
  foodCost?: number;

  @IsNumber()
  @IsOptional()
  waterCost?: number;

  @IsNumber()
  @IsOptional()
  accommodationCost?: number;

  @IsNumber()
  @IsOptional()
  maintenanceCost?: number;

  @IsNumber()
  @IsOptional()
  refuelingStops?: number;
}
```

---

### 2.6 `wayfare/models/stops.py` → `src/models/stops/stop.dto.ts`

```typescript
// src/models/stops/stop.dto.ts
import { IsString, IsInt, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto } from '../location/location.dto';

export class StopDto {
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @IsString()
  type: string; // 'rest', 'food', 'fuel', etc.

  @IsInt()
  duration: number; // minutes

  @IsArray()
  @IsString({ each: true })
  facilities: string[];

  @IsOptional()
  placeDetails?: any;
}
```

---

### 2.7 `wayfare/models/health.py` → `src/models/health/health.dto.ts`

```typescript
// src/models/health/health.dto.ts
import { IsNumber, IsObject } from 'class-validator';

export class HealthDto {
  @IsNumber()
  totalCalories: number;

  @IsObject()
  activityBreakdown: Record<string, number>;
}
```

---

### 2.8 `wayfare/models/vehicle.py` → `src/models/vehicle/`

```typescript
// src/models/vehicle/car-specifications.dto.ts
import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';

export class CarSpecificationsDto {
  @IsString()
  @IsOptional()
  model: string = 'Toyota Camry';

  @IsNumber()
  @IsOptional()
  fuelConsumption: number = 7.5; // L/100km

  @IsString()
  @IsIn(['gasoline', 'diesel', 'electric', '92', '95', '98'])
  @IsOptional()
  fuelType: string = 'gasoline';

  @IsNumber()
  @IsOptional()
  tankCapacity: number = 60; // liters

  @IsNumber()
  @IsOptional()
  initialFuel: number = 60; // liters
}
```

---

## 3. API Layer

### 3.1 `wayfare/api/dependencies.py` → `src/modules/*/providers.ts`

**Migration Notes:**
- 🔧 FastAPI Depends() → NestJS dependency injection
- ✅ LRU caching can be implemented with providers

**Code Example:**
```typescript
// src/modules/maps/maps.provider.ts
import { Provider } from '@nestjs/common';
import { GoogleMapsRepository } from '../repositories/maps/google-maps.repository';
import { ConfigService } from '@nestjs/config';

export const MapsRepositoryProvider: Provider = {
  provide: 'MAPS_REPOSITORY',
  useFactory: (configService: ConfigService) => {
    return new GoogleMapsRepository(
      configService.get<string>('GOOGLE_MAPS_API_KEY'),
    );
  },
  inject: [ConfigService],
};

export const MapsServiceProvider: Provider = {
  provide: 'MAPS_SERVICE',
  useFactory: (mapsRepository: GoogleMapsRepository) => {
    return new MapsService(mapsRepository);
  },
  inject: ['MAPS_REPOSITORY'],
};
```

---

### 3.2 `wayfare/api/v1/maps.py` → `src/modules/maps/maps.controller.ts`

| Python Endpoint | TypeScript Endpoint | Status |
|-----------------|---------------------|--------|
| `GET /search` | `GET /search` | ✅ |
| `GET /place/{place_id}` | `GET /place/:placeId` | ✅ |
| `GET /directions` | `GET /directions` | ✅ |

```typescript
// src/modules/maps/maps.controller.ts
import { 
  Controller, 
  Get, 
  Query, 
  Param, 
  HttpCode, 
  HttpStatus,
  ParseFloatPipe,
  ParseIntPipe,
  Min,
  Max,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { MapsService } from './maps.service';
import { SearchResultDto } from '../../models/base/search-result.dto';
import { PlaceDetailsDto } from '../../models/base/place-details.dto';
import { DirectionsQueryDto } from './dto/directions.dto';

@ApiTags('maps')
@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search for places' })
  @ApiQuery({ name: 'query', required: true, type: String })
  @ApiQuery({ name: 'latitude', required: false, type: Number })
  @ApiQuery({ name: 'longitude', required: false, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number })
  @ApiResponse({ status: 200, type: SearchResultDto })
  async searchPlaces(
    @Query('query') query: string,
    @Query('latitude', new ParseFloatPipe({ optional: true })) latitude?: number,
    @Query('longitude', new ParseFloatPipe({ optional: true })) longitude?: number,
    @Query('radius', new ParseIntPipe({ optional: true }), Min(0), Max(50000)) radius?: number,
  ): Promise<SearchResultDto> {
    return this.mapsService.searchPlaces({ query, latitude, longitude, radius });
  }

  @Get('place/:placeId')
  @ApiOperation({ summary: 'Get place details' })
  @ApiResponse({ status: 200, type: PlaceDetailsDto })
  async getPlaceDetails(
    @Param('placeId') placeId: string,
    @Query('source', new Min(0), Max(50000)) source: string = 'google',
  ): Promise<PlaceDetailsDto> {
    return this.mapsService.getPlaceDetails(placeId, source);
  }

  @Get('directions')
  @ApiOperation({ summary: 'Get directions between points' })
  @ApiResponse({ status: 200 })
  async getDirections(@Query() query: DirectionsQueryDto) {
    return this.mapsService.getDirections(query);
  }
}
```

---

### 3.3 `wayfare/api/v1/travel.py` → `src/modules/travel/travel.controller.ts`

```typescript
// src/modules/travel/travel.controller.ts
import { 
  Controller, 
  Post, 
  Body, 
  HttpCode, 
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { TravelService } from './travel.service';
import { TravelRequestDto } from '../../models/travel/travel-request.dto';
import { TravelResponseDto } from '../../models/travel/travel-response.dto';

@ApiTags('travel')
@Controller('travel')
export class TravelController {
  constructor(private readonly travelService: TravelService) {}

  @Post('route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Plan a travel route' })
  @ApiBody({ type: TravelRequestDto })
  @ApiResponse({ status: 200, type: TravelResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async planRoute(@Body() travelRequest: TravelRequestDto): Promise<TravelResponseDto> {
    try {
      return await this.travelService.planTravel(travelRequest);
    } catch (error) {
      if (error instanceof ValueError) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal server error while planning route',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
```

---

## 4. Repositories Layer

### 4.1 `wayfare/repositories/base.py` → `src/modules/repositories/base.repository.ts`

```typescript
// src/modules/repositories/base.repository.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';

export interface ISearchOptions {
  query: string;
  location?: { latitude: number; longitude: number; address?: string };
  filters?: Record<string, any>;
}

export interface ISearchResult {
  items: any[];
  totalCount: number;
  page?: number;
  hasMore?: boolean;
  metadata?: Record<string, any>;
}

@Injectable()
export abstract class BaseRepository {
  protected llm: ChatOpenAI;
  protected parserChain: LLMChain;

  constructor(protected apiKey: string, protected modelName: string = 'gpt-3.5-turbo') {
    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName,
      temperature: 0.7,
    });
    this._setupChains();
  }

  protected _setupChains(): void {
    this.parserChain = new LLMChain({
      llm: this.llm,
      prompt: PromptTemplate.fromTemplate(`
        Parse the following content into a structured format:
        {content}
        Extract key details like names, addresses, prices, and amenities.
        Format the output as a JSON object.
      `),
    });
  }

  abstract search(options: ISearchOptions): Promise<ISearchResult>;
  abstract getDetails(itemId: string): Promise<any>;
}
```

---

### 4.2 `wayfare/repositories/maps/google_maps.py` → `src/modules/repositories/maps/google-maps.repository.ts`

**Migration Notes:**
- ⚠️ Python `googlemaps` or requests → `axios`
- ✅ Same API endpoints
- ⚠️ Error handling patterns differ

```typescript
// src/modules/repositories/maps/google-maps.repository.ts
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { BaseRepository, ISearchOptions, ISearchResult } from '../base.repository';
import { LocationDto } from '../../../models/location/location.dto';
import { RouteDto } from '../../../models/route/route.dto';
import { PlaceDetailsDto } from '../../../models/base/place-details.dto';

@Injectable()
export class GoogleMapsRepository extends BaseRepository {
  private readonly httpClient: AxiosInstance;
  private readonly logger = new Logger(GoogleMapsRepository.name);

  constructor(apiKey: string) {
    super(apiKey);
    this.httpClient = axios.create({
      baseURL: 'https://maps.googleapis.com/maps/api',
      params: { key: apiKey },
    });
  }

  async geocode(address: string): Promise<LocationDto> {
    try {
      const response = await this.httpClient.get('/geocode/json', {
        params: { address },
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Geocoding failed: ${response.data.status}`);
      }

      const result = response.data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        address: result.formatted_address,
        placeId: result.place_id,
      };
    } catch (error) {
      this.logger.error(`Geocoding error for "${address}": ${error.message}`);
      throw error;
    }
  }

  async getDirections(
    origin: LocationDto,
    destination: LocationDto,
    mode: string = 'driving',
    waypoints?: LocationDto[],
  ): Promise<RouteDto> {
    const params: any = {
      origin: `${origin.latitude},${origin.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      mode,
    };

    if (waypoints?.length) {
      params.waypoints = waypoints
        .map(wp => `${wp.latitude},${wp.longitude}`)
        .join('|');
    }

    const response = await this.httpClient.get('/directions/json', { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Directions failed: ${response.data.status}`);
    }

    // Transform Google Maps response to RouteDto
    return this.transformRoute(response.data.routes[0]);
  }

  async searchPlaces(options: ISearchOptions): Promise<ISearchResult> {
    const params: any = { query: options.query };

    if (options.location) {
      params.location = `${options.location.latitude},${options.location.longitude}`;
    }

    if (options.filters?.radius) {
      params.radius = options.filters.radius;
    }

    const response = await this.httpClient.get('/place/textsearch/json', { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Places search failed: ${response.data.status}`);
    }

    return {
      items: response.data.results.map(this.transformPlace.bind(this)),
      totalCount: response.data.results.length,
      hasMore: response.data.next_page_token !== undefined,
    };
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetailsDto> {
    const response = await this.httpClient.get('/place/details/json', {
      params: { place_id: placeId },
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Place details failed: ${response.data.status}`);
    }

    return this.transformPlaceDetails(response.data.result);
  }

  private transformRoute(routeData: any): RouteDto {
    // Implementation to transform Google Maps route to RouteDto
    return {
      segments: routeData.legs.map((leg: any) => ({
        startLocation: { /* ... */ },
        endLocation: { /* ... */ },
        distance: leg.distance.value,
        duration: leg.duration.value / 60, // seconds to minutes
        polyline: leg.steps.map((s: any) => s.polyline?.points).join(''),
        instructions: leg.steps.map((s: any) => s.html_instructions),
      })),
      totalDistance: routeData.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0),
      totalDuration: routeData.legs.reduce((sum: number, leg: any) => sum + leg.duration.value / 60, 0),
      pathPoints: this.decodePolyline(routeData.overview_polyline?.points || ''),
    };
  }

  private decodePolyline(polyline: string): number[][] {
    // Polyline decoding implementation
    return [];
  }

  private transformPlace(placeData: any): PlaceDetailsDto {
    return {
      id: placeData.place_id,
      name: placeData.name,
      location: {
        latitude: placeData.geometry.location.lat,
        longitude: placeData.geometry.location.lng,
        address: placeData.formatted_address,
      },
      rating: placeData.rating,
      // ... other fields
    };
  }

  private transformPlaceDetails(placeData: any): PlaceDetailsDto {
    // Similar to transformPlace but with more details
    return this.transformPlace(placeData);
  }

  async getDetails(itemId: string): Promise<PlaceDetailsDto> {
    return this.getPlaceDetails(itemId);
  }
}
```

---

### 4.3 `wayfare/repositories/weather/open_weather_map.py` → `src/modules/repositories/weather/open-weather.repository.ts`

```typescript
// src/modules/repositories/weather/open-weather.repository.ts
import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenWeatherRepository {
  private readonly httpClient: AxiosInstance;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
    this.httpClient = axios.create({
      baseURL: 'https://api.openweathermap.org/data/2.5',
      params: { 
        appid: apiKey,
        units: 'metric',
      },
    });
  }

  async getCurrentWeather(lat: number, lon: number): Promise<any> {
    const response = await this.httpClient.get('/weather', {
      params: { lat, lon },
    });
    return response.data;
  }

  async getForecast(lat: number, lon: number): Promise<any> {
    const response = await this.httpClient.get('/forecast', {
      params: { lat, lon },
    });
    return response.data;
  }
}
```

---

## 5. Services Layer

### 5.1 `wayfare/services/base.py` → `src/services/base.service.ts`

```typescript
// src/services/base.service.ts
import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';
import { ConfigService } from '@nestjs/config';

@Injectable()
export abstract class BaseService {
  protected llm: ChatOpenAI;
  protected aggregatorChain: LLMChain;
  protected resolverChain: LLMChain;

  constructor(protected configService: ConfigService, modelName: string = 'gpt-3.5-turbo') {
    this.llm = new ChatOpenAI({
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
      modelName,
      temperature: 0.7,
    });
    this._setupChains();
  }

  protected _setupChains(): void {
    this.aggregatorChain = new LLMChain({
      llm: this.llm,
      prompt: PromptTemplate.fromTemplate(`
        Analyze and rank the following search results based on relevance,
        ratings, and overall quality:
        {results}
        Return a JSON array of ranked results with explanation for each ranking.
      `),
    });

    this.resolverChain = new LLMChain({
      llm: this.llm,
      prompt: PromptTemplate.fromTemplate(`
        Resolve conflicts in the following data from different sources:
        {conflicts}
        Return the most accurate consolidated information as JSON.
      `),
    });
  }

  abstract search(query: string, location?: any, filters?: any): Promise<any>;
  abstract getDetails(itemId: string, source: string): Promise<any>;
}
```

---

### 5.2 `wayfare/services/maps.py` → `src/modules/maps/maps.service.ts`

```typescript
// src/modules/maps/maps.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseService } from '../../services/base.service';
import { GoogleMapsRepository } from '../repositories/maps/google-maps.repository';
import { OSMRepository } from '../repositories/maps/osm.repository';
import { SearchResultDto } from '../../models/base/search-result.dto';
import { PlaceDetailsDto } from '../../models/base/place-details.dto';
import { RouteDto } from '../../models/route/route.dto';

@Injectable()
export class MapsService extends BaseService {
  private readonly logger = new Logger(MapsService.name);
  private readonly repositories: any[];

  constructor(
    protected configService: ConfigService,
    private googleMapsRepo: GoogleMapsRepository,
    private osmRepo: OSMRepository,
  ) {
    super(configService);
    this.repositories = [googleMapsRepo, osmRepo];
  }

  async searchPlaces(options: {
    query: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
  }): Promise<SearchResultDto> {
    const searchTasks = this.repositories.map(repo => 
      repo.search(options).catch(error => {
        this.logger.warn(`Repository search failed: ${error.message}`);
        return null;
      })
    );

    const results = await Promise.all(searchTasks);
    const validResults = results.filter(r => r !== null);

    if (validResults.length === 0) {
      return { items: [], totalCount: 0, hasMore: false };
    }

    // Aggregate results
    return this.aggregateResults(validResults);
  }

  async getPlaceDetails(placeId: string, source: string = 'google'): Promise<PlaceDetailsDto> {
    const repo = this.getRepositoryBySource(source);
    if (!repo) {
      throw new Error(`Unknown source: ${source}`);
    }
    return repo.getDetails(placeId);
  }

  async getDirections(options: {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    mode: string;
  }): Promise<any> {
    // Get directions from Google Maps (primary provider)
    const route = await this.googleMapsRepo.getDirections(
      { latitude: options.originLat, longitude: options.originLng },
      { latitude: options.destLat, longitude: options.destLng },
      options.mode,
    );

    // Use LLM to optimize route if multiple options
    return this.optimizeRoute(route);
  }

  private aggregateResults(results: any[]): SearchResultDto {
    // Aggregate and deduplicate results
    const allItems = results.flatMap(r => r.items);
    const uniqueItems = Array.from(
      new Map(allItems.map(item => [item.id, item])).values()
    );

    return {
      items: uniqueItems,
      totalCount: uniqueItems.length,
      hasMore: results.some(r => r.hasMore),
    };
  }

  private getRepositoryBySource(source: string): any {
    const sourceLower = source.toLowerCase();
    return this.repositories.find(repo => 
      repo.constructor.name.toLowerCase().includes(sourceLower)
    );
  }

  private async optimizeRoute(route: RouteDto): Promise<any> {
    // Use LLM chain to analyze and optimize route
    const result = await this.aggregatorChain.run(JSON.stringify(route));
    return { optimalRouteDescription: result, preferredRouteData: route };
  }
}
```

---

### 5.3 `wayfare/services/travel.py` → `src/services/travel.service.ts`

**Migration Notes:**
- 🔧 This is the most complex service - requires careful translation
- ✅ Business logic remains the same
- ⚠️ Async patterns translate directly

```typescript
// src/services/travel.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleMapsRepository } from '../modules/repositories/maps/google-maps.repository';
import { OpenWeatherRepository } from '../modules/repositories/weather/open-weather.repository';
import { SearchService } from './search.service';
import { StopsAgent } from '../modules/agents/stops.agent';
import { FuelPriceAgent } from '../modules/agents/fuel.agent';
import { WeatherAgent } from '../modules/agents/weather.agent';
import { TravelRequestDto } from '../models/travel/travel-request.dto';
import { TravelResponseDto } from '../models/travel/travel-response.dto';
import { TransportCostsDto } from '../models/costs/transport-costs.dto';
import { HealthDto } from '../models/health/health.dto';
import { TransportationType } from '../models/travel/transportation-type.enum';

@Injectable()
export class TravelService {
  private readonly logger = new Logger(TravelService.name);

  private readonly transportModeMapping: Record<TransportationType, string> = {
    [TransportationType.CAR]: 'driving',
    [TransportationType.MOTORCYCLE]: 'driving',
    [TransportationType.WALKING]: 'walking',
    [TransportationType.BICYCLE]: 'bicycling',
    [TransportationType.BUS]: 'transit',
    [TransportationType.TRAIN]: 'transit',
    [TransportationType.FERRY]: 'transit',
    [TransportationType.PLANE]: 'transit',
  };

  private readonly fuelPrices: Record<string, number> = {
    gasoline: 1.2,
    diesel: 1.1,
    electric: 0.15,
    '92': 1.1,
    '95': 1.25,
    '98': 1.4,
  };

  constructor(
    private mapsRepository: GoogleMapsRepository,
    private weatherRepository: OpenWeatherRepository,
    private searchService: SearchService,
    private stopsAgent: StopsAgent,
    private fuelAgent: FuelPriceAgent,
    private weatherAgent: WeatherAgent,
  ) {}

  async planTravel(request: TravelRequestDto): Promise<TravelResponseDto> {
    this.logger.log(`Planning travel from ${request.origin} to ${request.destination}`);

    try {
      // Geocode origin and destination
      const [originLocation, destinationLocation] = await Promise.all([
        this.mapsRepository.geocode(request.origin),
        this.mapsRepository.geocode(request.destination),
      ]);

      // Get route
      const mode = this.transportModeMapping[request.transportationType];
      const route = await this.mapsRepository.getDirections(
        originLocation,
        destinationLocation,
        mode,
      );

      // Calculate costs
      const costs = await this.calculateTransportCosts(
        route.totalDistance,
        route.totalDuration,
        request.transportationType,
        request,
      );

      // Calculate stops
      const stops = await this.calculateStops(route, request);

      // Calculate health metrics
      const health = this.calculateCalories(
        route.totalDistance,
        request.transportationType,
      );

      // Get weather data
      const weather = await this.weatherAgent.process({ route });

      return {
        route,
        stops,
        costs,
        health,
        weather,
      };
    } catch (error) {
      this.logger.error(`Travel planning failed: ${error.message}`);
      throw error;
    }
  }

  private async calculateTransportCosts(
    distanceMeters: number,
    durationMinutes: number,
    transportType: TransportationType,
    request: TravelRequestDto,
  ): Promise<TransportCostsDto> {
    const costs = new TransportCostsDto();
    const distanceKm = distanceMeters / 1000;

    // Food and water for long trips
    if (durationMinutes > 120) {
      costs.foodCost = 10 * (durationMinutes / 60);
      costs.waterCost = 2 * (durationMinutes / 60);
    }

    // Accommodation for very long trips
    if (durationMinutes > 960 && request.overnightStay?.maxPricePerNight) {
      costs.accommodationCost = request.overnightStay.maxPricePerNight;
    }

    // Transport-specific costs
    if (transportType === TransportationType.CAR && request.carSpecifications) {
      await this.calculateCarCosts(costs, distanceKm, request.carSpecifications);
    }

    costs.totalCost = (costs.fuelCost || 0) + (costs.ticketCost || 0) + 
                      (costs.foodCost || 0) + (costs.waterCost || 0) + 
                      (costs.accommodationCost || 0) + (costs.maintenanceCost || 0);

    return costs;
  }

  private async calculateCarCosts(
    costs: TransportCostsDto,
    distanceKm: number,
    specs: any,
  ): Promise<void> {
    const fuelLiters = (distanceKm / 100) * specs.fuelConsumption;
    const fuelPrice = this.fuelPrices[specs.fuelType] || 1.2;

    costs.fuelCost = fuelLiters * fuelPrice;
    costs.maintenanceCost = distanceKm * 0.05;
  }

  private async calculateStops(route: any, request: TravelRequestDto): Promise<any[]> {
    if (request.transportationType !== TransportationType.CAR &&
        request.transportationType !== TransportationType.MOTORCYCLE) {
      return [];
    }

    const response = await this.stopsAgent.process({
      routeDetails: route,
      transportationType: request.transportationType,
      vehicleSpecifications: request.carSpecifications || request.motorcycleSpecifications,
    });

    return response.success ? response.data.plannedStops || [] : [];
  }

  private calculateCalories(distanceMeters: number, transportType: TransportationType): HealthDto {
    const calorieRates: Record<TransportationType, number> = {
      [TransportationType.WALKING]: 0.5,
      [TransportationType.BICYCLE]: 0.3,
      [TransportationType.CAR]: 0.01,
      [TransportationType.MOTORCYCLE]: 0.01,
      [TransportationType.BUS]: 0.02,
      [TransportationType.TRAIN]: 0.02,
      [TransportationType.FERRY]: 0.02,
      [TransportationType.PLANE]: 0.01,
    };

    return {
      totalCalories: distanceMeters * (calorieRates[transportType] || 0.01),
      activityBreakdown: {
        [transportType]: distanceMeters * 0.1,
      },
    };
  }
}
```

---

## 6. Agents Layer

### 6.1 `wayfare/agents/base.py` → `src/modules/agents/base.agent.ts`

```typescript
// src/modules/agents/base.agent.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';

export interface AgentResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
}

@Injectable()
export abstract class BaseAgent {
  protected llm: ChatOpenAI;
  protected chain: LLMChain;

  constructor(protected configService: ConfigService, modelName?: string) {
    this.llm = new ChatOpenAI({
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
      modelName: modelName || this.configService.get<string>('OPENAI_MODEL_NAME') || 'gpt-3.5-turbo',
      temperature: 0.7,
    });
  }

  protected createChain(template: string, inputVariables: string[]): LLMChain {
    return new LLMChain({
      llm: this.llm,
      prompt: PromptTemplate.fromTemplate(template),
    });
  }

  abstract process(kwargs: Record<string, any>): Promise<AgentResponse>;
}
```

---

### 6.2 `wayfare/agents/route.py` → `src/modules/agents/route.agent.ts`

```typescript
// src/modules/agents/route.agent.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent, AgentResponse } from './base.agent';

@Injectable()
export class RouteAgent extends BaseAgent {
  private readonly logger = new Logger(RouteAgent.name);

  constructor(protected configService: ConfigService) {
    super(configService);
    this._setupChain();
  }

  private _setupChain(): void {
    this.chain = this.createChain(`
      You are a route planning expert. Plan the optimal route considering:
      - Start point: {startPoint}
      - End point: {endPoint}
      - Transportation type: {transportationType}
      - Waypoints: {waypoints}
      - Time constraints: {timeConstraints}
      - Additional preferences: {preferences}

      Consider traffic patterns, road conditions, and optimal routes.
    `, ['startPoint', 'endPoint', 'transportationType', 'waypoints', 'timeConstraints', 'preferences']);
  }

  async process(kwargs: Record<string, any>): Promise<AgentResponse> {
    try {
      const routeData = await this.planRoute(kwargs);
      return { success: true, data: routeData, error: undefined };
    } catch (error) {
      this.logger.error(`Route planning failed: ${error.message}`);
      return { success: false, data: {}, error: error.message };
    }
  }

  private async planRoute(kwargs: Record<string, any>): Promise<any> {
    // Implementation using Google Maps API via repository
    // Similar to Python implementation
    return {};
  }
}
```

---

### 6.3 `wayfare/agents/base.py` (AgentCoordinator) → `src/modules/agents/agents.coordinator.ts`

```typescript
// src/modules/agents/agents.coordinator.ts
import { Injectable } from '@nestjs/common';
import { RouteAgent } from './route.agent';
import { AccommodationAgent } from './accommodation.agent';
import { FuelStationAgent } from './fuel.agent';
import { TotalCostAgent } from './cost.agent';
import { StopsAgent } from './stops.agent';
import { FoodCostAgent } from './food.agent';
import { CaloriesAgent } from './health.agent';

@Injectable()
export class AgentsCoordinator {
  private readonly agents: Record<string, any>;

  constructor(
    private routeAgent: RouteAgent,
    private accommodationAgent: AccommodationAgent,
    private fuelStationAgent: FuelStationAgent,
    private totalCostAgent: TotalCostAgent,
    private stopsAgent: StopsAgent,
    private foodCostAgent: FoodCostAgent,
    private caloriesAgent: CaloriesAgent,
  ) {
    this.agents = {
      route: this.routeAgent,
      accommodation: this.accommodationAgent,
      fuelStation: this.fuelStationAgent,
      totalCost: this.totalCostAgent,
      stops: this.stopsAgent,
      foodCost: this.foodCostAgent,
      calories: this.caloriesAgent,
    };
  }

  async coordinateTripPlanning(request: Record<string, any>): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    // 1. Route Planning
    results.route = await this.agents.route.process(request);

    // 2. Fuel Planning (if car)
    if (request.transportationType === 'car') {
      results.fuelCosts = await this.agents.fuelStation.process({
        route: results.route.data,
      });
    }

    // 3. Stops Planning
    results.stops = await this.agents.stops.process({
      route: results.route.data,
      transportationType: request.transportationType,
    });

    // 4. Accommodation (if overnight)
    if (request.overnightStay?.required) {
      results.accommodation = await this.agents.accommodation.process({
        stops: results.stops.data,
        preferences: request.overnightStay,
      });
    }

    // 5. Food Costs
    results.foodCosts = await this.agents.foodCostAgent.process({
      duration: results.route.data.duration,
      stops: results.stops.data,
      passengers: request.passengers || 1,
    });

    // 6. Total Cost
    results.totalCosts = await this.agents.totalCost.process({
      route: results.route,
      accommodation: results.accommodation,
      fuelCosts: results.fuelCosts,
      foodCosts: results.foodCosts,
    });

    return results;
  }
}
```

---

## 7. Module Files

### 7.1 `src/app.module.ts`

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MapsModule } from './modules/maps/maps.module';
import { TravelModule } from './modules/travel/travel.module';
import { AgentsModule } from './modules/agents/agents.module';
import { RepositoriesModule } from './modules/repositories/repositories.module';
import { HealthModule } from './modules/health/health.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10,
    }),

    // Static files
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
    }),

    // Feature modules
    MapsModule,
    TravelModule,
    AgentsModule,
    RepositoriesModule,
    HealthModule,
  ],
})
export class AppModule {}
```

---

### 7.2 `src/modules/maps/maps.module.ts`

```typescript
// src/modules/maps/maps.module.ts
import { Module } from '@nestjs/common';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';
import { GoogleMapsRepository } from '../repositories/maps/google-maps.repository';
import { OSMRepository } from '../repositories/maps/osm.repository';

@Module({
  controllers: [MapsController],
  providers: [
    MapsService,
    GoogleMapsRepository,
    OSMRepository,
  ],
  exports: [MapsService],
})
export class MapsModule {}
```

---

### 7.3 `src/modules/travel/travel.module.ts`

```typescript
// src/modules/travel/travel.module.ts
import { Module } from '@nestjs/common';
import { TravelController } from './travel.controller';
import { TravelService } from '../../services/travel.service';
import { MapsModule } from '../maps/maps.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [MapsModule, RepositoriesModule, AgentsModule],
  controllers: [TravelController],
  providers: [TravelService],
  exports: [TravelService],
})
export class TravelModule {}
```

---

## 8. Package.json Template

See `05-package-json-template.md` for the complete package.json template.

---

## 9. Summary Table

| Python File | TypeScript File | Complexity | Notes |
|-------------|-----------------|------------|-------|
| `main.py` | `src/main.ts` | ⚠️ | Framework change |
| `core/settings.py` | `src/config/` | ⚠️ | Validation changes |
| `core/logging.py` | `src/common/utils/logger.ts` | ✅ | Direct translation |
| `models/*.py` | `src/models/**/*.dto.ts` | ✅ | Pydantic → class-validator |
| `api/v1/*.py` | `src/modules/*/`.controller.ts` | ⚠️ | FastAPI → NestJS |
| `api/dependencies.py` | `src/modules/*/providers.ts` | 🔧 | DI pattern change |
| `services/*.py` | `src/services/*.ts` | ⚠️ | LangChain.js adaptation |
| `repositories/**/*.py` | `src/modules/repositories/**/*.ts` | ⚠️ | HTTP client change |
| `agents/*.py` | `src/modules/agents/*.agent.ts` | ⚠️ | LangChain.js adaptation |

---

## 10. Next Steps

1. Review migration checklist (see `04-migration-checklist.md`)
2. Set up NestJS project with CLI
3. Begin with models migration (lowest risk)
4. Progress through repositories → services → controllers
