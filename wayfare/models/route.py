from typing import List, Optional
from pydantic import BaseModel, Field
from wayfare.models.location import Location

class RouteSegment(BaseModel):
    start_location: Location
    end_location: Location
    distance: float = Field(..., description="Distance in meters")
    duration: float = Field(..., description="Duration in minutes")
    polyline: str = Field(..., description="Encoded polyline for the segment")
    instructions: List[str] = Field(default_factory=list)

class Route(BaseModel):
    segments: List[RouteSegment]
    total_distance: float = Field(..., description="Total distance in meters")
    total_duration: float = Field(..., description="Total duration in minutes")
    overview_polyline: str = Field(..., description="Encoded polyline for the entire route")
    bounds: dict = Field(..., description="Northeast and southwest bounds of the route")
