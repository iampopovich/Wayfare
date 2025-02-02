from functools import lru_cache
from typing import Optional

from wayfare.services.maps import MapsService
from wayfare.services.travel import TravelService
from wayfare.core.settings import settings

# Load environment variables
# load_dotenv()

@lru_cache()
def get_maps_service() -> MapsService:
    """
    Create and cache MapsService instance.
    """
    return MapsService(
        google_maps_key=settings.GOOGLE_MAPS_API_KEY,
        mapsme_key=settings.MAPSME_API_KEY,
        model_name=settings.OPENAI_MODEL_NAME
    )

@lru_cache()
def get_travel_service() -> TravelService:
    """
    Create and cache TravelService instance.
    """
    return TravelService(
        booking_key=settings.BOOKING_API_KEY,
        trip_key=settings.TRIP_API_KEY,
        airbnb_key=settings.AIRBNB_API_KEY,
        model_name=settings.OPENAI_MODEL_NAME
    )
