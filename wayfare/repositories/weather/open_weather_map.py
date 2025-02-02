from typing import Dict, Any
import httpx
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class WeatherRepository:
    """Repository for interacting with Open-Meteo Weather API."""

    def __init__(self):
        self.base_url = "https://api.open-meteo.com/v1/forecast"

    async def get_weather(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """Get weather data for a specific location."""
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,wind_speed_10m",
            "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m",
            "timezone": "auto"
        }

        logger.info(f"Fetching weather data for lat={latitude}, lon={longitude}")
        async with httpx.AsyncClient() as client:
            response = await client.get(self.base_url, params=params)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Received weather data: {data}")
            return data

    def parse_weather_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse weather data into a more usable format."""
        logger.info("Parsing weather data")
        current = data.get("current", {})
        hourly = data.get("hourly", {})

        # Get current time index from hourly data
        current_time = datetime.fromisoformat(current.get("time", ""))
        hourly_times = [datetime.fromisoformat(t) for t in hourly.get("time", [])]
        
        try:
            current_index = hourly_times.index(current_time)
        except ValueError:
            current_index = 0
            logger.warning(f"Could not find current time {current_time} in hourly data, using index 0")

        # Get next 24 hours of data
        next_24h = slice(current_index, current_index + 24)

        parsed_data = {
            "current": {
                "temperature": current.get("temperature_2m"),
                "wind_speed": current.get("wind_speed_10m"),
                "time": current.get("time")
            },
            "forecast": {
                "times": hourly.get("time", [])[next_24h],
                "temperatures": hourly.get("temperature_2m", [])[next_24h],
                "humidity": hourly.get("relative_humidity_2m", [])[next_24h],
                "wind_speed": hourly.get("wind_speed_10m", [])[next_24h]
            }
        }
        logger.info(f"Parsed weather data: {parsed_data}")
        return parsed_data
