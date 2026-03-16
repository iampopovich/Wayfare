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

- **Backend:** NestJS 10+
- **Frontend:** Vue 3 + TypeScript + Vite
- **Language:** TypeScript 5+
- **Validation:** class-validator, class-transformer
- **AI/LLM:** LangChain.js, OpenAI
- **HTTP Client:** Axios
- **Maps:** OpenStreetMap
- **Weather:** OpenWeatherMap
- **Documentation:** Swagger/OpenAPI
- **UI Components:** PrimeVue 4
- **State Management:** Pinia
- **Routing:** Vue Router

## Installation

```bash
npm install
```

## Running the App

```bash
# Development mode (backend + frontend)
npm run start:dev        # Start NestJS backend
npm run dev:vue          # Start Vite dev server (in separate terminal)

# Production mode
npm run build            # Build both frontend and backend
npm run start:prod       # Start production server

# Debug mode
npm run start:debug
```

## API Documentation

Once the application is running, access the interactive API documentation at:
- **Swagger UI:** http://localhost:3000/api/docs

## Frontend

The Vue 3 web interface is available at:
- **Development:** http://localhost:3000/ (Vite dev server)
- **Production:** http://localhost:3000/ (served by NestJS)

For detailed frontend documentation, see [src/frontend/README.md](src/frontend/README.md)

### Frontend Structure

```
src/frontend/
├── assets/          # Static files (CSS, images)
├── components/      # Reusable Vue components
├── router/          # Vue Router configuration
├── services/        # API services (Axios)
├── stores/          # Pinia state management
├── views/           # Page components
├── App.vue          # Root component
├── main.ts          # Entry point
└── index.html       # HTML template
```

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
├── src/frontend/                  # Vue 3 application
│   ├── assets/                    # Static files
│   ├── components/                # Reusable components
│   ├── router/                    # Vue Router config
│   ├── services/                  # API services
│   ├── stores/                    # Pinia stores
│   └── views/                     # Page components
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

# Build frontend
npm run build:vue

# Build backend
npm run build

# Build both frontend and backend
npm run build

# Start Vite dev server (frontend)
npm run dev:vue
```

## License

MIT
