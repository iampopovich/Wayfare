from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from services.maps import MapsService
from api.dependencies import get_maps_service
from models.location import Location

router = APIRouter()

@router.get("/search")
async def search_places(
    query: str = Query(..., description="Search query for places"),
    latitude: Optional[float] = Query(None, ge=-90, le=90, description="Location latitude"),
    longitude: Optional[float] = Query(None, ge=-180, le=180, description="Location longitude"),
    radius: Optional[int] = Query(None, gt=0, le=50000, description="Search radius in meters"),
    maps_service: MapsService = Depends(get_maps_service)
):
    """Search for places using Google Maps."""
    location = Location(latitude=latitude, longitude=longitude) if latitude and longitude else None
    return await maps_service.search_places(query, location, radius)

@router.get("/place/{place_id}")
async def get_place_details(
    place_id: str,
    maps_service: MapsService = Depends(get_maps_service)
):
    """Get detailed information about a specific place."""
    return await maps_service.get_place_details(place_id)

@router.get("/directions")
async def get_directions(
    origin_lat: float = Query(..., ge=-90, le=90),
    origin_lng: float = Query(..., ge=-180, le=180),
    dest_lat: float = Query(..., ge=-90, le=90),
    dest_lng: float = Query(..., ge=-180, le=180),
    mode: str = Query("driving", regex="^(driving|walking|bicycling|transit)$"),
    maps_service: MapsService = Depends(get_maps_service)
):
    """Get directions between two points."""
    origin = Location(latitude=origin_lat, longitude=origin_lng)
    destination = Location(latitude=dest_lat, longitude=dest_lng)
    
    return await maps_service.get_directions(
        origin=origin,
        destination=destination,
        mode=mode
    )
