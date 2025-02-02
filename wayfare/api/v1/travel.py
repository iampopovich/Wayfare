from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from wayfare.services.travel import TravelService
from wayfare.api.v1.models import (
    AccommodationSearchRequest, SearchResponse, AccommodationResponse,
    AvailabilityRequest, ReviewsResponse, ErrorResponse
)
from wayfare.api.dependencies import get_travel_service

router = APIRouter(prefix="/travel", tags=["travel"])


@router.post("/search", response_model=SearchResponse)
async def search_accommodations(
    request: AccommodationSearchRequest,
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Search for accommodations across multiple providers.
    """
    try:
        result = await travel_service.search(
            query=request.query,
            location=request.location,
            filters={
                **request.filters or {},
                "check_in": request.check_in,
                "check_out": request.check_out,
                "guests": request.guests
            }
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{source}/{accommodation_id}", response_model=AccommodationResponse)
async def get_accommodation_details(
    source: str,
    accommodation_id: str,
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Get detailed information about a specific accommodation.
    """
    try:
        result = await travel_service.get_details(accommodation_id, source)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare-prices", response_model=dict)
async def compare_accommodation_prices(
    request: AvailabilityRequest,
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Compare prices for accommodations across different providers.
    """
    try:
        result = await travel_service.compare_prices(
            accommodation_ids=request.accommodation_ids,
            check_in=request.check_in,
            check_out=request.check_out,
            guests=request.guests
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/find-similar/{source}/{accommodation_id}", response_model=SearchResponse)
async def find_similar_accommodations(
    source: str,
    accommodation_id: str,
    max_price_difference: float = 0.2,
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Find similar accommodations across all providers.
    """
    try:
        result = await travel_service.find_similar_accommodations(
            reference_id=accommodation_id,
            source=source,
            max_price_difference=max_price_difference
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check-availability", response_model=dict)
async def check_accommodation_availability(
    request: AvailabilityRequest,
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Check availability for accommodations.
    """
    try:
        result = await travel_service.check_availability(
            accommodation_ids=request.accommodation_ids,
            check_in=request.check_in,
            check_out=request.check_out,
            guests=request.guests
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reviews/{source}/{accommodation_id}", response_model=ReviewsResponse)
async def get_accommodation_reviews(
    source: str,
    accommodation_id: str,
    page: int = 1,
    limit: int = 10,
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Get reviews for a specific accommodation.
    """
    try:
        result = await travel_service.get_reviews(
            accommodation_ids=[{"id": accommodation_id, "source": source}],
            page=page,
            limit=limit
        )
        return ReviewsResponse(
            reviews=result["reviews"],
            summary=result["summary"],
            total_reviews=result["total_reviews"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
