from typing import List, Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, validator


class TransportationType(str, Enum):
    PLANE = "plane"
    TRAIN = "train"
    BUS = "bus"
    WALK = "walk"
    CAR = "car"
    BICYCLE = "bicycle"
    SEA = "sea"


class SeaTransportType(str, Enum):
    FERRY = "ferry"
    CRUISE = "cruise"
    YACHT = "yacht"
    BOAT = "boat"
    CARGO_SHIP = "cargo_ship"


class BudgetRange(BaseModel):
    min_amount: float = Field(..., gt=0)
    max_amount: float = Field(..., gt=0)
    currency: str = "USD"

    @validator("max_amount")
    def max_amount_must_be_greater(cls, v, values):
        if "min_amount" in values and v <= values["min_amount"]:
            raise ValueError("max_amount must be greater than min_amount")
        return v


class SeaTransportPreference(BaseModel):
    transport_type: SeaTransportType = Field(..., description="Type of sea transport")
    cabin_class: Optional[str] = Field(
        None, description="Preferred cabin class for cruises/ferries"
    )
    max_travel_time: Optional[int] = Field(
        None, description="Maximum travel time in hours"
    )
    preferred_companies: Optional[List[str]] = Field(
        None, description="Preferred shipping/cruise companies"
    )
    require_onboard_accommodation: bool = Field(
        False, description="Whether overnight accommodation on board is required"
    )


class OvernightPreference(BaseModel):
    required: bool = Field(False, description="Whether overnight stays are required")
    max_price_per_night: Optional[float] = Field(
        None, description="Maximum price per night"
    )
    preferred_accommodation_types: Optional[List[str]] = Field(
        None,
        description="Preferred types of accommodation (hotel, hostel, apartment, etc.)",
    )
    min_rating: Optional[float] = Field(
        None, ge=0, le=5, description="Minimum rating for accommodation"
    )
    include_onboard_accommodation: bool = Field(
        False, description="Whether to include accommodation on sea transport"
    )


# Request Models
class LocationRequest(BaseModel):
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    address: Optional[str] = Field(None, description="Optional address")
    port_code: Optional[str] = Field(None, description="Port code for sea transport")


class SearchRequest(BaseModel):
    query: str = Field(..., description="Search query string")
    location: Optional[LocationRequest] = Field(
        None, description="Optional location for geo-based search"
    )
    filters: Optional[dict] = Field(None, description="Optional filters for search")
    budget: Optional[BudgetRange] = Field(
        None, description="Budget constraints for the search"
    )
    transportation: Optional[List[TransportationType]] = Field(
        None, description="Preferred transportation types"
    )
    sea_transport_preference: Optional[SeaTransportPreference] = Field(
        None, description="Sea transport specific preferences"
    )
    overnight_stay: Optional[OvernightPreference] = Field(
        None, description="Overnight stay preferences"
    )


class RouteRequest(BaseModel):
    origin: LocationRequest
    destination: LocationRequest
    waypoints: Optional[List[LocationRequest]] = None
    transportation_type: TransportationType = Field(
        TransportationType.CAR, description="Preferred mode of transportation"
    )
    sea_transport_preference: Optional[SeaTransportPreference] = Field(
        None, description="Sea transport specific preferences when using sea transport"
    )
    include_overnight_stays: bool = Field(
        False, description="Whether to include overnight stay recommendations"
    )
    budget_per_day: Optional[float] = Field(
        None, description="Maximum budget per day for the route"
    )
    overnight_preference: Optional[OvernightPreference] = None


class AccommodationSearchRequest(BaseModel):
    query: str
    location: Optional[LocationRequest] = None
    check_in: datetime
    check_out: datetime
    guests: int = Field(1, ge=1, description="Number of guests")
    budget: Optional[BudgetRange] = None
    transportation_to_city_center: Optional[List[TransportationType]] = Field(
        None, description="Preferred transportation types to city center"
    )
    filters: Optional[dict] = None


class AvailabilityRequest(BaseModel):
    accommodation_ids: List[dict] = Field(
        ..., description="List of accommodation IDs with their sources"
    )
    check_in: str
    check_out: str
    guests: int = Field(1, ge=1)
    max_budget_per_night: Optional[float] = None


# Response Models
class TransportationOption(BaseModel):
    type: TransportationType
    duration: float
    price: float
    currency: str = "USD"
    schedule: Optional[dict] = None
    provider: Optional[str] = None
    sea_transport_details: Optional[dict] = Field(
        None,
        description="Additional details for sea transport (ports, vessel info, etc.)",
    )


class AccommodationOption(BaseModel):
    id: str
    name: str
    location: LocationRequest
    price_per_night: float
    transportation_to_center: List[TransportationOption]
    rating: Optional[float] = None
    reviews_count: Optional[int] = None


class RouteSegment(BaseModel):
    start_location: LocationRequest
    end_location: LocationRequest
    transportation: TransportationOption
    overnight_stay: Optional[AccommodationOption] = None
    total_segment_cost: float
    port_details: Optional[dict] = Field(
        None, description="Port information for sea transport segments"
    )


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
    transportation_options: Optional[List[TransportationOption]] = None
    accommodation_options: Optional[List[AccommodationOption]] = None


class RouteResponse(BaseModel):
    segments: List[RouteSegment]
    total_distance: float
    total_duration: float
    total_cost: float
    currency: str = "USD"
    overnight_stays: Optional[List[AccommodationOption]] = None
    alternative_transportation: Optional[List[TransportationOption]] = None
    metadata: Optional[dict] = None


class AccommodationResponse(BaseModel):
    id: str
    name: str
    location: LocationRequest
    price_range: Optional[dict] = None
    transportation_options: List[TransportationOption]
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
