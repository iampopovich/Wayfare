from typing import List, Optional
from enum import Enum
from pydantic import BaseModel, Field, validator
from wayfare.models.location import Location
from wayfare.models.route import Route
from wayfare.models.stops import Stop
from wayfare.models.costs import Cost
from wayfare.models.health import Health
from wayfare.models.vehicle import CarSpecifications, TransportCosts

class TransportationType(str, Enum):
    CAR = "car"
    BUS = "bus"
    TRAIN = "train"
    WALKING = "walking"
    BICYCLE = "bicycle"
    FERRY = "ferry"
    PLANE = "plane"

class BudgetRange(BaseModel):
    min_amount: Optional[float] = Field(None, description="Minimum budget amount")
    max_amount: Optional[float] = Field(None, description="Maximum budget amount")
    currency: str = Field(default="USD", description="Currency code (e.g., USD, EUR)")

    @validator("max_amount")
    def validate_max_amount(cls, v, values):
        if v is not None and values.get("min_amount") is not None:
            if v < values["min_amount"]:
                raise ValueError("max_amount must be greater than min_amount")
        return v

class OvernightStay(BaseModel):
    required: bool = Field(default=False, description="Whether overnight stay is required")
    preferred_accommodation_type: Optional[str] = Field(None, description="Preferred type of accommodation (hotel, hostel, etc.)")
    max_price_per_night: Optional[float] = Field(None, description="Maximum price per night for accommodation")

class TravelRequest(BaseModel):
    origin: str = Field(..., description="Starting location (city or address)")
    destination: str = Field(..., description="Destination location (city or address)")
    transportation_type: TransportationType = Field(..., description="Type of transportation")
    
    # Car specific details
    car_specifications: Optional[CarSpecifications] = Field(None, description="Car specifications if traveling by car")
    
    # Public transport preferences
    prefer_direct_routes: Optional[bool] = Field(True, description="Prefer direct routes over transfers")
    max_transfers: Optional[int] = Field(None, description="Maximum number of transfers for public transport")
    
    # Common details
    passengers: int = Field(default=1, ge=1, le=10, description="Number of passengers")
    budget: Optional[BudgetRange] = None
    overnight_stay: Optional[OvernightStay] = None

    @validator("car_specifications")
    def validate_car_specs(cls, v, values):
        if values.get("transportation_type") == TransportationType.CAR:
            if not v:
                # Use default car specifications if none provided
                return CarSpecifications()
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "origin": "Phuket",
                "destination": "Satun",
                "transportation_type": "car",
                "car_specifications": {
                    "model": "Toyota Camry",
                    "fuel_consumption": 7.5,
                    "fuel_type": "gasoline",
                    "tank_capacity": 60
                },
                "passengers": 2,
                "budget": {
                    "min_amount": 1000,
                    "max_amount": 2000,
                    "currency": "USD"
                },
                "overnight_stay": {
                    "required": False,
                    "preferred_accommodation_type": "hotel",
                    "max_price_per_night": 100
                }
            }
        }

class TravelResponse(BaseModel):
    route: Route
    stops: List[Stop]
    costs: TransportCosts
    health: Health
