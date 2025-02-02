from typing import List, Optional
import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from services.maps import MapsService
from api.dependencies import get_maps_service
from models.location import Location

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/search")
async def search_places(
    query: str = Query(..., description="Search query for places"),
    latitude: Optional[float] = Query(
        None, ge=-90, le=90, description="Location latitude"
    ),
    longitude: Optional[float] = Query(
        None, ge=-180, le=180, description="Location longitude"
    ),
    radius: Optional[int] = Query(
        None, gt=0, le=50000, description="Search radius in meters"
    ),
    maps_service: MapsService = Depends(get_maps_service),
):
    """Search for places using Google Maps."""
    try:
        logger.info(
            f"Received place search request: query='{query}', lat={latitude}, lng={longitude}, radius={radius}"
        )
        location = (
            Location(latitude=latitude, longitude=longitude)
            if latitude and longitude
            else None
        )
        result = await maps_service.search_places(query, location, radius)
        logger.info(f"Successfully found {len(result)} places for query: '{query}'")
        return result
    except Exception as e:
        logger.error(f"Error searching places: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error while searching places")


@router.get("/place/{place_id}")
async def get_place_details(
    place_id: str, maps_service: MapsService = Depends(get_maps_service)
):
    """Get detailed information about a specific place."""
    try:
        logger.info(f"Fetching details for place_id: {place_id}")
        result = await maps_service.get_place_details(place_id)
        logger.info(f"Successfully retrieved details for place_id: {place_id}")
        return result
    except Exception as e:
        logger.error(f"Error getting place details: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error while getting place details")


@router.get("/directions")
async def get_directions(
    origin_lat: float = Query(..., ge=-90, le=90),
    origin_lng: float = Query(..., ge=-180, le=180),
    dest_lat: float = Query(..., ge=-90, le=90),
    dest_lng: float = Query(..., ge=-180, le=180),
    mode: str = Query("driving", regex="^(driving|walking|bicycling|transit)$"),
    maps_service: MapsService = Depends(get_maps_service),
):
    """Get directions between two points."""
    try:
        logger.info(
            f"Received directions request: origin=({origin_lat}, {origin_lng}), "
            f"destination=({dest_lat}, {dest_lng}), mode={mode}"
        )
        origin = Location(latitude=origin_lat, longitude=origin_lng)
        destination = Location(latitude=dest_lat, longitude=dest_lng)
        result = await maps_service.get_directions(origin, destination, mode)
        logger.info(
            f"Successfully retrieved directions from ({origin_lat}, {origin_lng}) "
            f"to ({dest_lat}, {dest_lng})"
        )
        return result
    except Exception as e:
        logger.error(f"Error getting directions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error while getting directions")
