# Wayfare Architecture

## System Overview

Wayfare is an AI-powered travel planning application built with NestJS, designed to provide comprehensive travel itineraries including routes, costs, stops, and personalized recommendations.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   Web    │  │  Mobile  │  │   CLI    │  │  Other   │       │
│  │   App    │  │   App    │  │   Tool   │  │   APIs   │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │   API Gateway Layer     │
        │   (NestJS Controllers)  │
        └───────────┬─────────────┘
                    │
        ┌───────────┴─────────────┐
        │    Business Logic       │
        │    (Services)           │
        ├─────────────────────────┤
        │  - MapsService          │
        │  - TravelService        │
        │  - SearchService        │
        └───────────┬─────────────┘
                    │
        ┌───────────┴─────────────┐
        │    AI Agents Layer      │
        │  (Agents Coordinator)   │
        ├─────────────────────────┤
        │  - RouteAgent           │
        │  - CostAgent            │
        │  - FuelAgent            │
        │  - StopsAgent           │
        │  - FoodAgent            │
        │  - WeatherAgent         │
        │  - HealthAgent          │
        │  - AccommodationAgent   │
        └───────────┬─────────────┘
                    │
        ┌───────────┴─────────────┐
        │   Data Access Layer     │
        │   (Repositories)        │
        ├─────────────────────────┤
        │  - GoogleMapsRepo       │
        │  - OSMRepo              │
        │  - BookingRepo          │
        │  - AirbnbRepo           │
        │  - OpenWeatherRepo      │
        └───────────┬─────────────┘
                    │
        ┌───────────┴─────────────┐
        │   External Services     │
        ├─────────────────────────┤
        │  - Google Maps API      │
        │  - OpenStreetMap        │
        │  - OpenWeatherMap       │
        │  - Booking.com          │
        │  - Airbnb               │
        └─────────────────────────┘
```

---

## Module Structure

### Core Modules

#### 1. Maps Module
**Purpose:** Handle all maps and places-related functionality

**Components:**
- `MapsController` - REST endpoints
- `MapsService` - Business logic
- `MapsProvider` - Multi-provider selection

**Dependencies:**
- `GoogleMapsRepository`
- `OSMRepository`

#### 2. Travel Module
**Purpose:** Handle travel planning and route optimization

**Components:**
- `TravelController` - REST endpoints
- `TravelService` - Main travel planning logic

**Dependencies:**
- `MapsRepository`
- `WeatherRepository`
- `SearchService`

#### 3. Agents Module
**Purpose:** AI-powered agents for specialized tasks

**Components:**
- `AgentsCoordinator` - Orchestrates agent execution
- `BaseAgent` - Abstract base class
- Individual agents (RouteAgent, CostAgent, etc.)

**Dependencies:**
- `ConfigService` (for OpenAI API key)

#### 4. Repositories Module
**Purpose:** Data access layer for external APIs

**Structure:**
- `BaseRepository` - Common functionality
- Map repositories (Google Maps, OSM, Maps.me)
- Travel repositories (Booking, Airbnb, TripAdvisor)
- Weather repositories (OpenWeatherMap)

#### 5. Health Module
**Purpose:** Health check endpoints for monitoring

**Components:**
- `HealthController` - Liveness and readiness probes

---

## Data Flow

### Travel Planning Flow

```
1. Client Request
   └─> POST /api/v1/travel/route

2. TravelController
   └─> Validates request DTO
   └─> Calls TravelService.planTravel()

3. TravelService
   ├─> Gets route from MapsRepository
   ├─> Calculates costs
   ├─> Calculates stops
   ├─> Gets weather data
   └─> Calls AgentsCoordinator

4. AgentsCoordinator
   ├─> RouteAgent analyzes route
   ├─> CostAgent provides optimization tips
   ├─> StopsAgent recommends stops
   ├─> FoodAgent suggests dining options
   ├─> WeatherAgent provides weather analysis
   └─> Aggregates all results

5. Response
   └─> Returns comprehensive travel plan
```

---

## Design Patterns

### 1. Dependency Injection (NestJS)
All services, repositories, and agents are injected via constructor injection.

```typescript
@Injectable()
export class TravelService {
  constructor(
    private readonly mapsRepository: GoogleMapsRepository,
    private readonly weatherRepository: OpenWeatherRepository,
    private readonly searchService: SearchService,
  ) {}
}
```

### 2. Repository Pattern
Data access is abstracted through repositories, allowing easy switching between providers.

```typescript
export interface IMapsRepository {
  geocode(address: string): Promise<ILocation>;
  getDirections(origin: ILocation, destination: ILocation): Promise<IRoute>;
  searchPlaces(query: string): Promise<ISearchResult>;
}
```

### 3. Agent Pattern
Each AI agent is responsible for a specific domain of travel planning.

```typescript
export abstract class BaseAgent {
  abstract execute(input: any): Promise<AgentResponse>;
  abstract getPromptTemplate(): string;
}
```

### 4. DTO Pattern
Data Transfer Objects ensure type safety and validation.

```typescript
export class TravelRequestDto {
  @IsString()
  origin: string;

  @IsEnum(TransportationType)
  transportationType: TransportationType;
}
```

---

## Technology Stack

### Runtime & Framework
- **Runtime:** Node.js 18+ LTS
- **Framework:** NestJS 10+
- **Language:** TypeScript 5+

### Validation & Serialization
- **Validation:** class-validator
- **Transformation:** class-transformer

### AI & LLM
- **LangChain:** langchain
- **OpenAI:** @langchain/openai

### HTTP & External APIs
- **HTTP Client:** axios
- **Retry Logic:** rxjs retry operators

### Testing
- **Unit Tests:** Jest
- **E2E Tests:** Supertest + Jest

### Documentation
- **OpenAPI:** @nestjs/swagger

### Logging
- **Logger:** Built-in NestJS Logger (winston/pino optional)

---

## Security Considerations

### 1. Input Validation
All user inputs are validated using class-validator decorators.

### 2. API Key Protection
API keys are stored in environment variables, never in code.

### 3. Rate Limiting
Implemented via @nestjs/throttler for API endpoints.

### 4. CORS
Configured to allow only trusted origins.

### 5. Error Handling
Global exception filters ensure errors don't leak sensitive information.

---

## Scalability

### Horizontal Scaling
- Stateless design allows easy horizontal scaling
- Session data stored externally (Redis optional)

### Caching
- LRU caching for API responses
- Redis integration available for distributed caching

### Queue System
- BullMQ available for background job processing
- Useful for long-running travel planning tasks

---

## Monitoring & Observability

### Health Checks
- `/api/v1/health/live` - Liveness probe
- `/api/v1/health/ready` - Readiness probe

### Logging
- Structured JSON logging
- Request/response logging middleware

### Metrics (Future)
- Prometheus metrics endpoint
- Performance monitoring

---

## Future Enhancements

1. **Database Integration**
   - Prisma or TypeORM for persistent storage
   - User preferences and history

2. **Authentication**
   - JWT-based authentication
   - OAuth2 for social login

3. **Real-time Updates**
   - WebSocket support for live traffic/weather updates

4. **Microservices**
   - Split monolith into microservices
   - Each module becomes independent service

5. **GraphQL API**
   - Alternative to REST API
   - More flexible querying
