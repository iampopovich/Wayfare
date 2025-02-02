from typing import List, Optional
from pydantic import BaseModel, Field, validator
from wayfare.models.location import Location
from wayfare.models.route import Route
from wayfare.models.stops import Stop
from wayfare.models.costs import Cost
from wayfare.models.health import Health

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

class TravelRequest(BaseModel):
    origin: str = Field(..., description="Starting location (city or address)")
    destination: str = Field(..., description="Destination location (city or address)")
    transportation_type: str = Field(..., description="Type of transportation (car, bus, train, walking, bicycle)")
    car_model: Optional[str] = Field(None, description="Car model if transportation_type is car")
    passengers: int = Field(default=1, ge=1, le=10, description="Number of passengers")
    budget: Optional[BudgetRange] = None
    overnight_stay: Optional[OvernightStay] = None

    @validator("transportation_type")
    def validate_transportation_type(cls, v):
        valid_types = {"car", "bus", "train", "walking", "bicycle"}
        if v.lower() not in valid_types:
            raise ValueError(f"Invalid transportation type. Must be one of: {', '.join(valid_types)}")
        return v.lower()

    class Config:
        json_schema_extra = {
            "example": {
                "origin": "Phuket",
                "destination": "Satun",
                "transportation_type": "car",
                "passengers": 2,
                "budget": {
                    "min_amount": 1000,
                    "max_amount": 2000,
                    "currency": "USD"
                },
                "overnight_stay": {
                    "required": False
                }
            }
        }

class TravelResponse(BaseModel):
    route: Route
    stops: List[Stop]
    costs: Cost
    health: Health
