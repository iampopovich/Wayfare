from typing import Dict
from pydantic import BaseModel, Field

class Health(BaseModel):
    total_calories: float = Field(..., description="Total calories burned during the trip")
    activity_breakdown: Dict[str, float] = Field(
        ...,
        description="Breakdown of calories by activity type"
    )
