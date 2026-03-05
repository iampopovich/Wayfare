# Proposed Node.js/JavaScript Project Structure

## Overview

This document outlines the proposed Node.js/JavaScript project structure for Wayfare, maintaining similar functionality while following Node.js best practices and leveraging the NestJS framework.

---

## 1. Recommended Technology Stack

### Core Framework
| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Framework** | NestJS v10+ | TypeScript-first, modular, DI built-in, matches current architecture |
| **Language** | TypeScript 5+ | Type safety, better IDE support, easier Python migration |
| **Runtime** | Node.js 18+ LTS | LTS support, async/await native |

### Data & Validation
| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Validation** | class-validator + class-transformer | Decorator-based, integrates with NestJS |
| **Serialization** | class-transformer | Auto-transform plain objects to classes |
| **Configuration** | @nestjs/config | Environment-based config with validation |

### AI & LLM
| Component | Technology | Rationale |
|-----------|------------|-----------|
| **LangChain** | langchain + @langchain/openai | Direct migration path from Python |
| **OpenAI SDK** | @langchain/openai | Official LangChain OpenAI integration |

### HTTP & External APIs
| Component | Technology | Rationale |
|-----------|------------|-----------|
| **HTTP Client** | axios | Promise-based, interceptors, widely used |
| **Retry Logic** | nestjs-axios + rxjs retry | Built-in retry mechanisms |

### Database (Optional/Future)
| Component | Technology | Rationale |
|-----------|------------|-----------|
| **ORM** | Prisma or TypeORM | Type-safe database access |
| **Redis** | ioredis | Caching, session storage |
| **Queue** | BullMQ | Job processing, async tasks |

### Testing
| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Unit Tests** | Jest | Industry standard, NestJS default |
| **E2E Tests** | Supertest + Jest | API testing |
| **Mocking** | ts-mockito | TypeScript mocking |

### Documentation
| Component | Technology | Rationale |
|-----------|------------|-----------|
| **OpenAPI** | @nestjs/swagger | Auto-generated API docs |
| **README** | Markdown | Standard documentation |

### Logging & Monitoring
| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Logging** | pino or winston | High-performance structured logging |
| **Health Checks** | @nestjs/terminus | Kubernetes-ready health endpoints |

### Security
| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Helmet** | @nestjs/helmet | Security headers |
| **Rate Limiting** | @nestjs/throttler | API rate limiting |
| **CORS** | @nestjs/cors | CORS handling |

---

## 2. Proposed Directory Structure

```
wayfare/
├── src/                          # Source code root
│   ├── main.ts                   # Application entry point
│   ├── app.module.ts             # Root application module
│   │
│   ├── common/                   # Shared utilities and decorators
│   │   ├── decorators/           # Custom decorators
│   │   │   ├── index.ts
│   │   │   └── public.decorator.ts
│   │   ├── filters/              # Exception filters
│   │   │   ├── index.ts
│   │   │   ├── http-exception.filter.ts
│   │   │   └── global-exception.filter.ts
│   │   ├── guards/               # Route guards
│   │   │   ├── index.ts
│   │   │   └── api-key.guard.ts
│   │   ├── interceptors/         # Response/request interceptors
│   │   │   ├── index.ts
│   │   │   ├── logging.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   ├── middleware/           # Express middleware
│   │   │   ├── index.ts
│   │   │   └── logger.middleware.ts
│   │   ├── pipes/                # Validation pipes
│   │   │   ├── index.ts
│   │   │   └── parse-int.pipe.ts
│   │   └── utils/                # Utility functions
│   │       ├── index.ts
│   │       ├── logger.ts
│   │       └── helpers.ts
│   │
│   ├── config/                   # Configuration management
│   │   ├── index.ts
│   │   ├── app.config.ts         # App settings (port, host)
│   │   ├── openai.config.ts      # OpenAI settings
│   │   ├── maps.config.ts        # Maps API keys
│   │   ├── travel.config.ts      # Travel API keys
│   │   └── config.validation.ts  # Config validation schema
│   │
│   ├── models/                   # Data models (DTOs and entities)
│   │   ├── index.ts
│   │   ├── base/                 # Base models
│   │   │   ├── index.ts
│   │   │   ├── geo-location.dto.ts
│   │   │   ├── place-details.dto.ts
│   │   │   ├── search-result.dto.ts
│   │   │   └── price-range.dto.ts
│   │   ├── location/             # Location models
│   │   │   ├── index.ts
│   │   │   └── location.dto.ts
│   │   ├── route/                # Route models
│   │   │   ├── index.ts
│   │   │   ├── route-segment.dto.ts
│   │   │   └── route.dto.ts
│   │   ├── travel/               # Travel models
│   │   │   ├── index.ts
│   │   │   ├── travel-request.dto.ts
│   │   │   ├── travel-response.dto.ts
│   │   │   ├── transportation-type.enum.ts
│   │   │   ├── budget-range.dto.ts
│   │   │   └── overnight-stay.dto.ts
│   │   ├── stops/                # Stop models
│   │   │   ├── index.ts
│   │   │   └── stop.dto.ts
│   │   ├── costs/                # Cost models
│   │   │   ├── index.ts
│   │   │   ├── cost.dto.ts
│   │   │   └── transport-costs.dto.ts
│   │   ├── health/               # Health models
│   │   │   ├── index.ts
│   │   │   └── health.dto.ts
│   │   └── vehicle/              # Vehicle models
│   │       ├── index.ts
│   │       ├── car-specifications.dto.ts
│   │       ├── motorcycle-specifications.dto.ts
│   │       └── vehicle-type.enum.ts
│   │
│   ├── modules/                  # Feature modules (NestJS modules)
│   │   │
│   │   ├── maps/                 # Maps module
│   │   │   ├── maps.module.ts
│   │   │   ├── maps.controller.ts
│   │   │   ├── maps.service.ts
│   │   │   ├── maps.provider.ts
│   │   │   └── dto/
│   │   │       ├── index.ts
│   │   │       ├── search-places.dto.ts
│   │   │       └── directions.dto.ts
│   │   │
│   │   ├── travel/               # Travel module
│   │   │   ├── travel.module.ts
│   │   │   ├── travel.controller.ts
│   │   │   ├── travel.service.ts
│   │   │   └── dto/
│   │   │       └── plan-travel.dto.ts
│   │   │
│   │   ├── agents/               # AI Agents module
│   │   │   ├── agents.module.ts
│   │   │   ├── agents.coordinator.ts
│   │   │   ├── base.agent.ts
│   │   │   ├── route.agent.ts
│   │   │   ├── accommodation.agent.ts
│   │   │   ├── fuel.agent.ts
│   │   │   ├── cost.agent.ts
│   │   │   ├── health.agent.ts
│   │   │   ├── stops.agent.ts
│   │   │   ├── food.agent.ts
│   │   │   └── weather.agent.ts
│   │   │
│   │   ├── repositories/         # Data access module
│   │   │   ├── repositories.module.ts
│   │   │   ├── base.repository.ts
│   │   │   ├── maps/
│   │   │   │   ├── index.ts
│   │   │   │   ├── base-maps.repository.ts
│   │   │   │   ├── google-maps.repository.ts
│   │   │   │   ├── osm.repository.ts
│   │   │   │   └── mapsme.repository.ts
│   │   │   ├── travel/
│   │   │   │   ├── index.ts
│   │   │   │   ├── booking.repository.ts
│   │   │   │   ├── airbnb.repository.ts
│   │   │   │   └── trip.repository.ts
│   │   │   └── weather/
│   │   │       ├── index.ts
│   │   │       └── open-weather.repository.ts
│   │   │
│   │   └── health/               # Health check module
│   │       ├── health.module.ts
│   │       └── health.controller.ts
│   │
│   └── services/                 # Shared services
│       ├── index.ts
│       ├── base.service.ts
│       ├── search.service.ts
│       └── travel.service.ts
│
├── test/                         # Test files
│   ├── unit/                     # Unit tests
│   │   ├── services/
│   │   ├── repositories/
│   │   └── agents/
│   ├── e2e/                      # E2E tests
│   │   ├── maps.e2e-spec.ts
│   │   └── travel.e2e-spec.ts
│   └── mocks/                    # Test mocks
│       ├── index.ts
│       └── repositories.mock.ts
│
├── public/                       # Static files (replaces static/)
│   ├── index.html
│   ├── css/
│   └── js/
│
├── docs/                         # Documentation
│   ├── api/                      # API documentation
│   ├── architecture/             # Architecture docs
│   └── migration/                # Migration notes
│
├── scripts/                      # Build and utility scripts
│   ├── build.ts
│   └── seed-data.ts
│
├── .env.example                  # Environment variables template
├── .env                          # Local environment (gitignored)
├── .gitignore
├── nest-cli.json                 # NestJS CLI configuration
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.build.json           # Build-specific TS config
├── jest.config.json              # Jest configuration
├── .eslintrc.js                  # ESLint configuration
├── .prettierrc                   # Prettier configuration
└── README.md                     # Project documentation
```

---

## 3. Module Breakdown

### 3.1 Root Module (`app.module.ts`)

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MapsModule,
    TravelModule,
    AgentsModule,
    RepositoriesModule,
    HealthModule,
  ],
})
export class AppModule {}
```

### 3.2 Maps Module

**Purpose:** Handle all maps-related functionality

**Components:**
- `MapsController` - REST endpoints for maps operations
- `MapsService` - Business logic for maps aggregation
- `MapsProvider` - Multi-provider selection logic

**Endpoints:**
```
GET  /api/v1/maps/search
GET  /api/v1/maps/place/:placeId
GET  /api/v1/maps/directions
```

### 3.3 Travel Module

**Purpose:** Handle travel planning and route optimization

**Components:**
- `TravelController` - REST endpoints for travel operations
- `TravelService` - Main travel planning business logic

**Endpoints:**
```
POST /api/v1/travel/route
```

### 3.4 Agents Module

**Purpose:** AI-powered agents for specialized tasks

**Components:**
- `AgentsCoordinator` - Orchestrates agent execution
- `BaseAgent` - Abstract base class for all agents
- Individual agents (RouteAgent, AccommodationAgent, etc.)

### 3.5 Repositories Module

**Purpose:** Data access layer for external APIs

**Structure:**
- `BaseRepository` - Common repository functionality
- Map repositories (Google Maps, OSM, Maps.me)
- Travel repositories (Booking, Airbnb, TripAdvisor)
- Weather repositories (OpenWeatherMap)

---

## 4. Key Design Patterns

### 4.1 Dependency Injection (NestJS)

```typescript
@Injectable()
export class TravelService {
  constructor(
    private readonly mapsRepository: GoogleMapsRepository,
    private readonly weatherRepository: OpenWeatherRepository,
    private readonly searchService: SearchService,
    private readonly stopsAgent: StopsAgent,
  ) {}
}
```

### 4.2 Module Pattern

Each feature is encapsulated in a NestJS module:
- Encapsulated scope
- Clear dependencies
- Easy to test in isolation

### 4.3 DTO Pattern

Data Transfer Objects for request/response validation:

```typescript
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
}
```

### 4.4 Repository Pattern

```typescript
export interface IMapsRepository {
  geocode(address: string): Promise<GeoLocationDto>;
  getDirections(origin: LocationDto, destination: LocationDto, mode: string): Promise<RouteDto>;
  searchPlaces(query: string, location?: GeoLocationDto): Promise<SearchResultDto>;
}
```

---

## 5. File Organization Principles

### 5.1 By Feature (Primary)
Files are organized by feature/module rather than by type:
```
modules/
  maps/
    controller.ts
    service.ts
    repository.ts
```

### 5.2 Shared Code
Common utilities go in `common/`:
```
common/
  decorators/
  filters/
  guards/
  interceptors/
  pipes/
  utils/
```

### 5.3 Models Separation
Models are kept separate from modules for cross-module reuse:
```
models/
  travel/
  route/
  location/
```

---

## 6. Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Modules | PascalCase + Module | `TravelModule` |
| Controllers | PascalCase + Controller | `TravelController` |
| Services | PascalCase + Service | `TravelService` |
| Repositories | PascalCase + Repository | `GoogleMapsRepository` |
| Agents | PascalCase + Agent | `RouteAgent` |
| DTOs | PascalCase + Dto | `TravelRequestDto` |
| Enums | PascalCase + Type | `TransportationType` |
| Interfaces | IPascalCase | `IMapsRepository` |
| Files | kebab-case | `travel.service.ts` |

---

## 7. Entry Point (`main.ts`)

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  });

  // Swagger
  setupSwagger(app);

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  Logger.log(`Application running on: http://localhost:${port}`);
}

bootstrap();
```

---

## 8. Configuration Structure

### Environment Variables (`.env`)

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL_NAME=gpt-3.5-turbo

# Maps
GOOGLE_MAPS_API_KEY=...
MAPSME_API_KEY=...

# Travel
BOOKING_API_KEY=...
TRIP_API_KEY=...
AIRBNB_API_KEY=...

# Redis (optional)
REDIS_URL=redis://localhost:6379/0
```

---

## 9. Build & Development Commands

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  }
}
```

---

## 10. Comparison: Python vs Node.js Structure

| Python (FastAPI) | Node.js (NestJS) | Notes |
|------------------|------------------|-------|
| `main.py` | `src/main.ts` | Entry point |
| `api/v1/` | `src/modules/*/` | Routes → Controllers |
| `services/` | `src/services/` + `src/modules/*/` | Business logic |
| `repositories/` | `src/modules/repositories/` | Data access |
| `models/` | `src/models/` | Data models |
| `agents/` | `src/modules/agents/` | AI agents |
| `core/settings.py` | `src/config/` | Configuration |
| `core/logging.py` | `src/common/utils/logger.ts` | Logging |
| `static/` | `public/` | Static files |
| `requirements.txt` | `package.json` | Dependencies |
| `.env` | `.env` | Environment variables |

---

## 11. Next Steps

1. Review file-by-file mapping (see `03-file-mapping.md`)
2. Review migration checklist (see `04-migration-checklist.md`)
3. Set up initial NestJS project structure
4. Begin with models migration (lowest risk)
