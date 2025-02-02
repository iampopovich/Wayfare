from typing import Dict, Any
from agents.base import BaseAgent, AgentResponse
from repositories.weather.open_weather_map import WeatherRepository
import logging

logger = logging.getLogger(__name__)

class WeatherAgent(BaseAgent):
    """Agent for getting weather information for route points."""

    def __init__(self, weather_repository: WeatherRepository):
        super().__init__()
        self.weather_repository = weather_repository

    def _setup_chain(self):
        """No LLM chain needed for this agent."""
        pass

    async def process(self, **kwargs) -> Dict[str, Any]:
        """Process weather data for route points."""
        try:
            route = kwargs.get("route", {})
            if not route or "segments" not in route:
                raise ValueError("No route data provided")

            logger.info("Processing route for weather data")
            # Get start and end points
            start_segment = route["segments"][0]
            end_segment = route["segments"][-1]

            start_location = start_segment["start_location"]
            end_location = end_segment["end_location"]

            logger.info(f"Getting weather for start location: {start_location}")
            # Get weather data for both locations
            start_weather = await self.weather_repository.get_weather(
                start_location["latitude"],
                start_location["longitude"]
            )

            logger.info(f"Getting weather for end location: {end_location}")
            end_weather = await self.weather_repository.get_weather(
                end_location["latitude"],
                end_location["longitude"]
            )

            # Parse weather data
            logger.info("Parsing weather data for both locations")
            weather_data = {
                "origin": {
                    "location": start_location["address"],
                    "weather": self.weather_repository.parse_weather_data(start_weather)
                },
                "destination": {
                    "location": end_location["address"],
                    "weather": self.weather_repository.parse_weather_data(end_weather)
                }
            }

            # Add weather alerts and recommendations
            weather_data["recommendations"] = self._generate_recommendations(weather_data)
            logger.info(f"Generated weather data with recommendations: {weather_data}")

            return AgentResponse(
                success=True,
                data=weather_data,
                error=None
            ).to_dict()

        except Exception as e:
            logger.error(f"Error processing weather data: {str(e)}", exc_info=True)
            return AgentResponse(
                success=False,
                data={},
                error=str(e)
            ).to_dict()

    def _generate_recommendations(self, weather_data: Dict[str, Any]) -> list[str]:
        """Generate weather-based recommendations."""
        recommendations = []
        
        # Check temperature differences
        origin_temp = weather_data["origin"]["weather"]["current"]["temperature"]
        dest_temp = weather_data["destination"]["weather"]["current"]["temperature"]
        
        if abs(origin_temp - dest_temp) > 10:
            recommendations.append(
                f"Temperature difference of {abs(origin_temp - dest_temp):.1f}°C between origin and destination. "
                "Pack appropriate clothing for both locations."
            )

        # Check for high winds
        for location in ["origin", "destination"]:
            wind_speed = weather_data[location]["weather"]["current"]["wind_speed"]
            if wind_speed > 10:
                recommendations.append(
                    f"High winds ({wind_speed:.1f} m/s) at {location}. "
                    "Consider potential impacts on travel time."
                )

        # Check temperature extremes
        for location in ["origin", "destination"]:
            temp = weather_data[location]["weather"]["current"]["temperature"]
            if temp > 30:
                recommendations.append(
                    f"High temperature ({temp:.1f}°C) at {location}. "
                    "Stay hydrated and avoid prolonged sun exposure."
                )
            elif temp < 0:
                recommendations.append(
                    f"Low temperature ({temp:.1f}°C) at {location}. "
                    "Pack warm clothing and be prepared for winter conditions."
                )

        return recommendations
