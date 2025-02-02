from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from wayfare.services.maps import MapsService
from wayfare.api.v1.models import (
    SearchRequest, SearchResponse, RouteRequest, RouteResponse,
    LocationRequest, ErrorResponse
)
from wayfare.api.dependencies import get_maps_service

router = APIRouter(prefix="/maps", tags=["maps"])


@router.post("/search", response_model=SearchResponse)
async def search_places(
    request: SearchRequest,
    maps_service: MapsService = Depends(get_maps_service)
):
    """
    Search for places across multiple map providers.
    """
    try:
        result = await maps_service.search(
            query=request.query,
            location=request.location,
            filters=request.filters
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/route", response_model=RouteResponse)
async def get_route(
    request: RouteRequest,
    maps_service: MapsService = Depends(get_maps_service)
):
    """
    Get optimal route between two points.
    """
    try:
        result = await maps_service.get_route(
            origin=request.origin,
            destination=request.destination,
            waypoints=request.waypoints,
            mode=request.mode
        )
        return RouteResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/geocode", response_model=LocationRequest)
async def geocode_address(
    address: str,
    prefer_source: Optional[str] = None,
    maps_service: MapsService = Depends(get_maps_service)
):
    """
    Convert address to coordinates.
    """
    try:
        result = await maps_service.geocode(address, prefer_source)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reverse-geocode", response_model=str)
async def reverse_geocode(
    location: LocationRequest,
    maps_service: MapsService = Depends(get_maps_service)
):
    """
    Convert coordinates to address.
    """
    try:
        result = await maps_service.reverse_geocode(location)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/nearby", response_model=SearchResponse)
async def find_nearby_places(
    location: LocationRequest,
    radius: float = 1000,
    types: Optional[List[str]] = None,
    maps_service: MapsService = Depends(get_maps_service)
):
    """
    Find places near a specific location.
    """
    try:
        result = await maps_service.find_places_nearby(
            location=location,
            radius=radius,
            types=types
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/place/{source}/{place_id}", response_model=dict)
async def get_place_details(
    source: str,
    place_id: str,
    maps_service: MapsService = Depends(get_maps_service)
):
    """
    Get detailed information about a specific place.
    """
    try:
        result = await maps_service.get_details(place_id, source)
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
