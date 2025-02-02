from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from wayfare.services.travel import TravelService
from wayfare.api.v1.models import (
    AccommodationSearchRequest, SearchResponse, AccommodationResponse,
    AvailabilityRequest, ReviewsResponse, ErrorResponse, TransportationType,
    BudgetRange, OvernightPreference, RouteRequest, RouteResponse
)
from wayfare.api.dependencies import get_travel_service

router = APIRouter(prefix="/travel", tags=["travel"])


@router.post("/search", response_model=SearchResponse)
async def search_accommodations(
    request: AccommodationSearchRequest,
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Search for accommodations across multiple providers with budget and transportation preferences.
    """
    try:
        result = await travel_service.search(
            query=request.query,
            location=request.location,
            filters={
                **request.filters or {},
                "check_in": request.check_in,
                "check_out": request.check_out,
                "guests": request.guests,
                "budget": request.budget,
                "transportation_to_city_center": request.transportation_to_city_center
            }
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/route", response_model=RouteResponse)
async def plan_route(
    request: RouteRequest,
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Plan a route with transportation and overnight stay options.
    """
    try:
        result = await travel_service.plan_route(
            origin=request.origin,
            destination=request.destination,
            waypoints=request.waypoints,
            transportation_type=request.transportation_type,
            include_overnight_stays=request.include_overnight_stays,
            budget_per_day=request.budget_per_day,
            overnight_preference=request.overnight_preference
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{source}/{accommodation_id}", response_model=AccommodationResponse)
async def get_accommodation_details(
    source: str,
    accommodation_id: str,
    transportation_types: Optional[List[TransportationType]] = Query(None),
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Get detailed information about a specific accommodation including transportation options.
    """
    try:
        result = await travel_service.get_details(
            accommodation_id,
            source,
            transportation_types=transportation_types
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare-prices", response_model=dict)
async def compare_accommodation_prices(
    request: AvailabilityRequest,
    include_transportation: bool = Query(False),
    transportation_types: Optional[List[TransportationType]] = Query(None),
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Compare prices for accommodations across different providers, including transportation costs.
    """
    try:
        result = await travel_service.compare_prices(
            accommodation_ids=request.accommodation_ids,
            check_in=request.check_in,
            check_out=request.check_out,
            guests=request.guests,
            max_budget_per_night=request.max_budget_per_night,
            include_transportation=include_transportation,
            transportation_types=transportation_types
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/find-similar/{source}/{accommodation_id}", response_model=SearchResponse)
async def find_similar_accommodations(
    source: str,
    accommodation_id: str,
    max_price_difference: float = Query(0.2),
    include_transportation: bool = Query(False),
    transportation_types: Optional[List[TransportationType]] = Query(None),
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Find similar accommodations across all providers with transportation options.
    """
    try:
        result = await travel_service.find_similar_accommodations(
            reference_id=accommodation_id,
            source=source,
            max_price_difference=max_price_difference,
            include_transportation=include_transportation,
            transportation_types=transportation_types
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
    Check availability for accommodations with budget constraints.
    """
    try:
        result = await travel_service.check_availability(
            accommodation_ids=request.accommodation_ids,
            check_in=request.check_in,
            check_out=request.check_out,
            guests=request.guests,
            max_budget_per_night=request.max_budget_per_night
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reviews/{source}/{accommodation_id}", response_model=ReviewsResponse)
async def get_accommodation_reviews(
    source: str,
    accommodation_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Get reviews for a specific accommodation with rating filter.
    """
    try:
        result = await travel_service.get_reviews(
            accommodation_ids=[{"id": accommodation_id, "source": source}],
            page=page,
            limit=limit,
            min_rating=min_rating
        )
        return ReviewsResponse(
            reviews=result["reviews"],
            summary=result["summary"],
            total_reviews=result["total_reviews"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/calculate-trip-cost", response_model=dict)
async def calculate_trip_cost(
    origin: str,
    destination: str,
    transportation_types: List[TransportationType],
    budget_range: BudgetRange,
    overnight_preference: Optional[OvernightPreference] = None,
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Calculate estimated trip cost including transportation and accommodation.
    """
    try:
        result = await travel_service.calculate_trip_cost(
            origin=origin,
            destination=destination,
            transportation_types=transportation_types,
            budget_range=budget_range,
            overnight_preference=overnight_preference
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
