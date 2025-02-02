from functools import lru_cache
from fastapi import Depends

from config import get_settings
from services.travel import TravelService
from services.maps import MapsService
from repositories.maps.google_maps import GoogleMapsRepository

# Load environment variables
# load_dotenv()

@lru_cache()
def get_maps_repository() -> GoogleMapsRepository:
    settings = get_settings()
    return GoogleMapsRepository(api_key=settings.GOOGLE_MAPS_API_KEY)

@lru_cache()
def get_maps_service(
    maps_repository: GoogleMapsRepository = Depends(get_maps_repository)
) -> MapsService:
    return MapsService(maps_repository=maps_repository)

@lru_cache()
def get_travel_service(
    maps_repository: GoogleMapsRepository = Depends(get_maps_repository)
) -> TravelService:
    return TravelService(maps_repository=maps_repository)
