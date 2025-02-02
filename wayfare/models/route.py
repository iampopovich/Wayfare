from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from models.location import Location

class RouteSegment(BaseModel):
    start_location: Location
    end_location: Location
    distance: float  # in meters
    duration: float  # in minutes
    polyline: str
    instructions: List[str]

class Route(BaseModel):
    segments: List[RouteSegment]
    total_distance: float  # in meters
    total_duration: float  # in minutes
    path_points: List[List[float]]  # List of [lat, lng] coordinates for the actual route
