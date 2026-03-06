import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RouteAgent } from './route.agent';
import { AccommodationAgent } from './accommodation.agent';
import { FuelAgent } from './fuel.agent';
import { CostAgent } from './cost.agent';
import { HealthAgent } from './health.agent';
import { StopsAgent } from './stops.agent';
import { FoodAgent } from './food.agent';
import { WeatherAgent } from './weather.agent';
import { AgentsCoordinator } from './agents.coordinator';

/**
 * Agents Module - Provides all AI-powered travel planning agents
 * Registered as global to be available throughout the application
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    // Individual agents
    RouteAgent,
    AccommodationAgent,
    FuelAgent,
    CostAgent,
    HealthAgent,
    StopsAgent,
    FoodAgent,
    WeatherAgent,

    // Coordinator
    AgentsCoordinator,
  ],
  exports: [
    // Export all agents for use in other modules
    RouteAgent,
    AccommodationAgent,
    FuelAgent,
    CostAgent,
    HealthAgent,
    StopsAgent,
    FoodAgent,
    WeatherAgent,
    AgentsCoordinator,
  ],
})
export class AgentsModule {}
