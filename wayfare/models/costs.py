from typing import Dict
from pydantic import BaseModel, Field


class Cost(BaseModel):
    total_amount: float = Field(..., description="Total cost of the trip")
    currency: str = Field(default="USD")
    breakdown: Dict[str, float] = Field(
        ..., description="Breakdown of costs by category (transportation, food, etc.)"
    )
