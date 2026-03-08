# Wayfare - AI-Powered Travel Planner

Wayfare is an intelligent travel planning application that uses AI agents to create comprehensive trip itineraries including routes, costs, stops, weather, and personalized recommendations.

## Features

- 🚗 **Multi-modal Route Planning** - Car, motorcycle, bus, train, walking, bicycle
- 💰 **Cost Estimation** - Fuel, maintenance, food, water, and accommodation costs
- ⛽ **Fuel Calculation** - Automatic refueling stop planning
- 🍽️ **Food & Accommodation** - AI-powered recommendations
- 🌤️ **Weather Integration** - Real-time weather data for your route
- 🧠 **AI Agents** - Specialized agents for route, cost, health, stops, and weather analysis

## Tech Stack

- **Framework:** NestJS 10+
- **Language:** TypeScript 5+
- **Validation:** class-validator, class-transformer
- **AI/LLM:** LangChain.js, OpenAI
- **HTTP Client:** Axios
- **Maps:** OpenStreetMap
- **Weather:** OpenWeatherMap
- **Documentation:** Swagger/OpenAPI

## Installation

```bash
npm install
```

## Running the App

```bash
# Development mode (with hot-reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

## API Documentation

Once the application is running, access the interactive API documentation at:
- **Swagger UI:** http://localhost:3000/api/docs

## Frontend

The web interface is available at:
- **Application:** http://localhost:3000/

## API Endpoints

### Maps
- `GET /api/v1/maps/search` - Search for places
- `GET /api/v1/maps/place/:placeId` - Get place details
- `GET /api/v1/maps/directions` - Get directions between points

### Travel
- `POST /api/v1/travel/route` - Plan a complete travel itinerary

### Health
- `GET /api/v1/health/live` - Liveness check
- `GET /api/v1/health/ready` - Readiness check

## Project Structure

```
wayfare/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module
│   ├── common/                    # Shared utilities
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── middleware/
│   │   ├── pipes/
│   │   └── utils/
│   ├── config/                    # Configuration
│   ├── models/                    # DTOs and data models
│   ├── modules/                   # Feature modules
│   │   ├── maps/                  # Maps service
│   │   ├── travel/                # Travel planning
│   │   ├── agents/                # AI agents
│   │   ├── repositories/          # Data access layer
│   │   └── health/                # Health checks
│   └── services/                  # Business logic services
├── public/                        # Static files (frontend)
├── test/                          # Tests
│   ├── unit/
│   └── e2e/
└── docs/                          # Documentation
```

## Configuration

Create a `.env` file in the root directory:

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# DeepSeek
DEEPSEEK_API_KEY=your-api-key-here
DEEPSEEK_MODEL_NAME=deepseek-chat

# Weather
OPENWEATHER_API_KEY=your-openweather-key
```

## Testing

```bash
# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Run tests with coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## Development Commands

```bash
# Format code
npm run format

# Lint code
npm run lint

# Build for production
npm run build
```

## License

MIT
