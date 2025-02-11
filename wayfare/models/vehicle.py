from typing import Optional
from pydantic import BaseModel, Field


class CarSpecifications(BaseModel):
    """Car specifications for fuel consumption calculation"""

    model: str = Field(default="Standard 1.6L", description="Car model")
    engine_volume: float = Field(default=1.6, description="Engine volume in liters")
    fuel_consumption: float = Field(
        default=11.0, description="Fuel consumption in liters per 100km"
    )
    fuel_type: str = Field(
        default="gasoline", description="Type of fuel (e.g., gasoline, diesel)"
    )
    tank_capacity: float = Field(
        default=50.0, description="Fuel tank capacity in liters"
    )
    initial_fuel: float = Field(
        default=50.0, description="Current fuel level in liters"
    )
    base_mass: float = Field(default=1200.0, description="Base vehicle mass in kg")
    passenger_mass: float = Field(
        default=75.0, description="Standard passenger mass in kg"
    )

    @property
    def fuel_level_percentage(self) -> float:
        """Calculate current fuel level as percentage of tank capacity"""
        return (
            (self.initial_fuel / self.tank_capacity) * 100
            if self.tank_capacity > 0
            else 0
        )

    class Config:
        json_schema_extra = {
            "example": {
                "model": "Standard 1.6L",
                "engine_volume": 1.6,
                "fuel_consumption": 11.0,
                "fuel_type": "gasoline",
                "tank_capacity": 50.0,
                "initial_fuel": 25.0,
                "base_mass": 1200.0,
                "passenger_mass": 75.0,
            }
        }


class TransportCosts(BaseModel):
    """Cost breakdown for different transportation types"""

    class Config:
        use_enum_values = True

    # For cars and motorcycles
    fuel_cost: Optional[float] = Field(None, description="Cost of fuel for the journey")
    fuel_consumption: Optional[float] = Field(
        None, description="Total fuel consumption in liters"
    )
    refueling_stops: Optional[int] = Field(
        None, description="Number of refueling stops needed"
    )
    maintenance_cost: Optional[float] = Field(
        None, description="Estimated maintenance cost for the journey"
    )

    # For public transport
    ticket_cost: Optional[float] = Field(None, description="Cost of tickets")
    booking_url: Optional[str] = Field(None, description="URL for booking tickets")

    # Common costs
    food_cost: Optional[float] = Field(
        None, description="Estimated food cost for the journey"
    )
    accommodation_cost: Optional[float] = Field(
        None, description="Cost of accommodation if overnight stays are needed"
    )
    water_cost: Optional[float] = Field(
        None, description="Cost of water and basic supplies"
    )

    # Total
    total_cost: float = Field(..., description="Total cost of the journey")
    currency: str = Field(default="USD", description="Currency for all costs")


class MotorcycleSpecifications(BaseModel):
    """Motorcycle specifications for fuel consumption calculation"""

    engine_cc: int = Field(default=125, description="Engine size in cubic centimeters")
    fuel_economy: float = Field(
        default=45.0, description="Fuel economy in kilometers per liter"
    )
    fuel_type: str = Field(
        default="92", description="Type of fuel (e.g., 92, 95, 98 octane)"
    )
    tank_capacity: float = Field(
        default=10.0, description="Fuel tank capacity in liters"
    )
    initial_fuel: float = Field(
        default=5.0, description="Current fuel level in liters"
    )
    base_mass: float = Field(default=150.0, description="Base vehicle mass in kg")
    passenger_mass: float = Field(
        default=75.0, description="Standard passenger mass in kg"
    )

    @property
    def fuel_level_percentage(self) -> float:
        """Calculate current fuel level as percentage of tank capacity"""
        return (
            (self.initial_fuel / self.tank_capacity) * 100
            if self.tank_capacity > 0
            else 0
        )

    class Config:
        json_schema_extra = {
            "example": {
                "engine_cc": 125,
                "fuel_economy": 45.0,
                "fuel_type": "92",
                "tank_capacity": 10.0,
                "initial_fuel": 5.0,
                "base_mass": 150.0,
                "passenger_mass": 75.0,
            }
        }
