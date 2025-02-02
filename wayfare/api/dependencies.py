from functools import lru_cache
from fastapi import Depends

from config import get_settings
from repositories.maps.google_maps import GoogleMapsRepository
from repositories.weather.open_weather_map import WeatherRepository
from services.maps import MapsService
from services.search import SearchService
from services.travel import TravelService

# Load environment variables
# load_dotenv()


@lru_cache()
def get_maps_repository() -> GoogleMapsRepository:
    """Get GoogleMapsRepository instance."""
    return GoogleMapsRepository(api_key=get_settings().GOOGLE_MAPS_API_KEY)


@lru_cache()
def get_weather_repository() -> WeatherRepository:
    """Get WeatherRepository instance."""
    return WeatherRepository()


def get_search_service() -> SearchService:
    """Get SearchService instance."""
    return SearchService()


@lru_cache()
def get_maps_service(
    maps_repository: GoogleMapsRepository = Depends(get_maps_repository),
) -> MapsService:
    return MapsService(maps_repository=maps_repository)


def get_travel_service(
    maps_repository: GoogleMapsRepository = Depends(get_maps_repository),
    weather_repository: WeatherRepository = Depends(get_weather_repository),
    search_service: SearchService = Depends(get_search_service),
) -> TravelService:
    """Get TravelService instance."""
    return TravelService(
        maps_repository=maps_repository,
        weather_repository=weather_repository,
        search_service=search_service,
    )
