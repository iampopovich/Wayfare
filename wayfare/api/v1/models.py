from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

# Request Models
class LocationRequest(BaseModel):
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    address: Optional[str] = Field(None, description="Optional address")

class SearchRequest(BaseModel):
    query: str = Field(..., description="Search query string")
    location: Optional[LocationRequest] = Field(None, description="Optional location for geo-based search")
    filters: Optional[dict] = Field(None, description="Optional filters for search")

class RouteRequest(BaseModel):
    origin: LocationRequest
    destination: LocationRequest
    waypoints: Optional[List[LocationRequest]] = None
    mode: str = Field("driving", description="Travel mode: driving, walking, bicycling, transit")

class AccommodationSearchRequest(BaseModel):
    query: str
    location: Optional[LocationRequest] = None
    check_in: datetime
    check_out: datetime
    guests: int = Field(1, ge=1, description="Number of guests")
    filters: Optional[dict] = None

class AvailabilityRequest(BaseModel):
    accommodation_ids: List[dict] = Field(..., description="List of accommodation IDs with their sources")
    check_in: str
    check_out: str
    guests: int = Field(1, ge=1)

# Response Models
class ErrorResponse(BaseModel):
    error: str
    details: Optional[str] = None

class SuccessResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None

class SearchResponse(BaseModel):
    items: List[dict]
    total_count: int
    page: int = 1
    has_more: bool = False
    metadata: Optional[dict] = None

class RouteResponse(BaseModel):
    distance: float
    duration: float
    steps: List[dict]
    polyline: Optional[str] = None
    metadata: Optional[dict] = None

class AccommodationResponse(BaseModel):
    id: str
    name: str
    location: LocationRequest
    price_range: Optional[dict] = None
    rating: Optional[float] = None
    reviews_count: Optional[int] = None
    photos: Optional[List[str]] = None
    amenities: Optional[List[str]] = None
    metadata: Optional[dict] = None

class ReviewsResponse(BaseModel):
    reviews: List[dict]
    summary: Optional[str] = None
    total_reviews: int
    metadata: Optional[dict] = None
