from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class GeoLocation(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None


class PriceRange(BaseModel):
    min_price: float
    max_price: float
    currency: str = "USD"


class PlaceDetails(BaseModel):
    id: str
    name: str
    location: GeoLocation
    description: Optional[str] = None
    rating: Optional[float] = None
    reviews_count: Optional[int] = None
    photos: Optional[List[str]] = None
    amenities: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class Accommodation(PlaceDetails):
    price_range: Optional[PriceRange] = None
    room_types: Optional[List[str]] = None
    available_dates: Optional[List[datetime]] = None
    booking_url: Optional[str] = None


class SearchResult(BaseModel):
    items: List[PlaceDetails]
    total_count: int
    page: int = 1
    has_more: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)
