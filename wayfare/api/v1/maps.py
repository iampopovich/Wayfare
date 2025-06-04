from typing import Optional # List removed as it's not used directly in type hints here
import logging
from fastapi import APIRouter, Depends, Query, HTTPException

from services.maps import MapsService
from api.dependencies import get_maps_service
from models.location import Location as ModelLocation # Renamed to avoid conflict with parameter name
from models.base import GeoLocation # For API request model if needed, or for service layer. Service expects GeoLocation for some methods.
from repositories.maps.google_maps import ( # Importing custom exceptions
    MapsServiceError,
    GeocodingError,
    DirectionsError,
    PlacesSearchError,
    PlaceDetailsError,
)
# Import SearchResult and PlaceDetails if they are used as response_model
from models.base import SearchResult, PlaceDetails as ModelPlaceDetails # Renamed for clarity
from models.route import Route as ModelRoute # Renamed for clarity


logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/search", response_model=SearchResult) # Added response_model
async def search_places_api( # Renamed function for clarity
    query: str = Query(..., description="Search query for places"),
    latitude: Optional[float] = Query(
        None, ge=-90, le=90, description="Location latitude (WGS84)"
    ),
    longitude: Optional[float] = Query(
        None, ge=-180, le=180, description="Location longitude (WGS84)"
    ),
    radius: Optional[int] = Query(
        None, gt=0, le=50000, description="Search radius in meters"
    ),
    # TODO: Add filters parameter if maps_service.search_places supports it more broadly
    maps_service: MapsService = Depends(get_maps_service),
):
    """Search for places using various map providers."""
    try:
        logger.info(
            f"Received place search request: query='{query}', lat={latitude}, lng={longitude}, radius={radius}"
        )

        # MapsService.search_places expects Optional[GeoLocation]
        search_location: Optional[GeoLocation] = None
        if latitude is not None and longitude is not None:
            search_location = GeoLocation(latitude=latitude, longitude=longitude)

        # The MapsService.search_places was updated to accept radius directly
        result = await maps_service.search_places(query=query, location=search_location, radius=radius, filters=None) # Passing None for filters for now

        # No need to log len(result) as result is a SearchResult object
        logger.info(f"Successfully processed search for query: '{query}'")
        return result
    except PlacesSearchError as e:
        logger.error(f"Places search error for query '{query}': {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"Map service search error: {e}")
    except ValueError as e: # Catching potential validation errors from service layer
        logger.warning(f"Validation error in search request for query '{query}': {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error searching places for query '{query}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while searching places.")


@router.get("/place/{place_id}", response_model=ModelPlaceDetails) # Added response_model
async def get_place_details_api( # Renamed function for clarity
    place_id: str,
    source: Optional[str] = Query("google", description="The map provider source (e.g., 'google', 'osm')"), # Assuming source is needed
    maps_service: MapsService = Depends(get_maps_service),
):
    """Get detailed information about a specific place from a specified source."""
    try:
        logger.info(f"Fetching details for place_id: '{place_id}' from source: '{source}'")
        # MapsService.get_place_details expects item_id and source
        result = await maps_service.get_place_details(item_id=place_id, source=source)
        if not result: # Should be handled by PlaceDetailsError if not found, but as a safeguard
            raise HTTPException(status_code=404, detail=f"Place with ID '{place_id}' not found from source '{source}'.")
        logger.info(f"Successfully retrieved details for place_id: '{place_id}' from source: '{source}'")
        return result
    except PlaceDetailsError as e:
        logger.error(f"Place details error for place_id '{place_id}', source '{source}': {e}", exc_info=True)
        # Check if the error message implies "not found"
        if "not found" in str(e).lower() or "no details found" in str(e).lower():
            raise HTTPException(status_code=404, detail=f"Details for place ID '{place_id}' not found or error retrieving: {e}")
        raise HTTPException(status_code=503, detail=f"Map service details error: {e}")
    except ValueError as e:
        logger.warning(f"Validation error in place details request for '{place_id}': {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting place details for '{place_id}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while getting place details.")


@router.get("/directions", response_model=Dict[str, Any]) # Response model could be more specific if LLM output is structured
async def get_directions_api( # Renamed function for clarity
    origin_lat: float = Query(..., description="Origin latitude (WGS84)", ge=-90, le=90),
    origin_lng: float = Query(..., description="Origin longitude (WGS84)", ge=-180, le=180),
    dest_lat: float = Query(..., description="Destination latitude (WGS84)", ge=-90, le=90),
    dest_lng: float = Query(..., description="Destination longitude (WGS84)", ge=-180, le=180),
    mode: str = Query("driving", description="Mode of transport", regex="^(driving|walking|bicycling|transit)$"),
    # waypoints: Optional[List[str]] = Query(None, description="List of waypoints as 'lat,lng' strings") # Example if adding waypoints
    maps_service: MapsService = Depends(get_maps_service),
):
    """Get directions between two points, optimized by LLM."""
    try:
        logger.info(
            f"Received directions request: origin=({origin_lat},{origin_lng}), "
            f"destination=({dest_lat},{dest_lng}), mode='{mode}'"
        )
        # MapsService.get_directions expects GeoLocation for origin/destination
        origin_loc = GeoLocation(latitude=origin_lat, longitude=origin_lng)
        destination_loc = GeoLocation(latitude=dest_lat, longitude=dest_lng)

        # TODO: Handle waypoints if added to API
        # parsed_waypoints: Optional[List[GeoLocation]] = None
        # if waypoints:
        #     parsed_waypoints = []
        #     for wp_str in waypoints:
        #         try:
        #             lat, lng = map(float, wp_str.split(','))
        #             parsed_waypoints.append(GeoLocation(latitude=lat, longitude=lng))
        #         except ValueError:
        #             raise HTTPException(status_code=400, detail=f"Invalid waypoint format: '{wp_str}'. Expected 'lat,lng'.")

        result = await maps_service.get_directions(origin=origin_loc, destination=destination_loc, mode=mode, waypoints=None) # waypoints=parsed_waypoints

        logger.info(
            f"Successfully processed directions request from ({origin_lat},{origin_lng}) "
            f"to ({dest_lat},{dest_lng})"
        )
        return result # This is a Dict[str, Any] as per MapsService.get_directions
    except DirectionsError as e:
        logger.error(f"Directions error for origin ({origin_lat},{origin_lng}), dest ({dest_lat},{dest_lng}): {e}", exc_info=True)
        if "no route found" in str(e).lower() or "no valid routes found" in str(e).lower() :
             raise HTTPException(status_code=404, detail=f"Could not find directions: {e}")
        raise HTTPException(status_code=503, detail=f"Map service directions error: {e}")
    except ValueError as e:
        logger.warning(f"Validation error in directions request: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting directions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while getting directions.")
