from typing import List, Optional, Any
from pydantic import BaseModel, Field
from models.location import Location

class Stop(BaseModel):
    location: Location
    type: str = Field(..., description="Type of stop (rest, food, fuel, etc.)")
    duration: int = Field(..., description="Duration of stop in minutes")
    facilities: List[str] = Field(default_factory=list)
    place_details: Optional[Any] = None
