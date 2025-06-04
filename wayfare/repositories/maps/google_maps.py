from typing import Optional, List, Dict, Any
import googlemaps
import googlemaps.exceptions
import polyline
from models.base import GeoLocation, PlaceDetails, SearchResult # GeoLocation might be used by the new search_places
from models.location import Location # Used for origin/destination, and preferred for location input in search
from models.route import Route, RouteSegment
import logging

logger = logging.getLogger(__name__)

# Custom Exception Hierarchy
class MapsServiceError(Exception):
    """Base class for Google Maps service errors."""
    pass

class GeocodingError(MapsServiceError):
    """Error during geocoding."""
    pass

class ReverseGeocodingError(MapsServiceError):
    """Error during reverse geocoding."""
    pass

class DirectionsError(MapsServiceError):
    """Error retrieving directions."""
    pass

class PlacesSearchError(MapsServiceError):
    """Error searching for places."""
    pass

class PlaceDetailsError(MapsServiceError):
    """Error retrieving place details."""
    pass


class GoogleMapsRepository:
    def __init__(self, api_key: str):
        """Initialize Google Maps client."""
        logger.info("Initializing Google Maps client")
        self.client = googlemaps.Client(key=api_key)

    async def geocode(self, address: str) -> GeoLocation:
        """Convert address to coordinates using Google Maps API."""
        logger.info(f"Attempting to geocode address: '{address}'")
        try:
            result = self.client.geocode(address)
            if not result:
                logger.warning(f"No geocoding results found for address: '{address}'")
                raise GeocodingError(f"No results found for address: {address}")

            location_data = result[0]["geometry"]["location"]
            geo_location = GeoLocation(
                latitude=location_data["lat"],
                longitude=location_data["lng"],
                address=result[0]["formatted_address"],
            )
            logger.info(
                f"Successfully geocoded '{address}' to: lat={geo_location.latitude}, lng={geo_location.longitude}, address='{geo_location.address}'"
            )
            return geo_location
        except googlemaps.exceptions.ApiError as e:
            logger.error(f"Google Maps API error while geocoding '{address}': {e}", exc_info=True)
            raise GeocodingError(f"API error during geocoding for '{address}': {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error while geocoding '{address}': {e}", exc_info=True)
            raise GeocodingError(f"Unexpected error during geocoding for '{address}': {e}") from e

    async def reverse_geocode(self, location: GeoLocation) -> str:
        """Convert coordinates to address using Google Maps API."""
        logger.info(
            f"Attempting to reverse geocode location: lat={location.latitude}, lng={location.longitude}"
        )
        try:
            latlng = (location.latitude, location.longitude)
            result = self.client.reverse_geocode(latlng)
            if not result:
                logger.warning(f"No reverse geocoding results found for location: {location}")
                raise ReverseGeocodingError(f"No results found for location: {location}")

            address = result[0]["formatted_address"]
            logger.info(f"Successfully reverse geocoded {location} to address: '{address}'")
            return address
        except googlemaps.exceptions.ApiError as e:
            logger.error(f"Google Maps API error during reverse geocoding for {location}: {e}", exc_info=True)
            raise ReverseGeocodingError(f"API error during reverse geocoding for {location}: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error during reverse geocoding for {location}: {e}", exc_info=True)
            raise ReverseGeocodingError(f"Unexpected error during reverse geocoding for {location}: {e}") from e

    async def get_directions(
        self,
        origin: Location,
        destination: Location,
        mode: str = "driving",
        waypoints: Optional[List[Location]] = None,
        alternatives: bool = True,
    ) -> Route:
        """Get directions between two points using actual roads and routes."""
        logger.info(
            f"Attempting to get directions from origin='{origin}' to destination='{destination}' via mode='{mode}'"
            f"{(' with waypoints: ' + str(waypoints)) if waypoints else ''}."
        )

        waypoints_formatted: Optional[List[str]] = None
        if waypoints:
            waypoints_formatted = [f"{w.latitude},{w.longitude}" for w in waypoints]

        try:
            directions_result = self.client.directions(
                origin=f"{origin.latitude},{origin.longitude}",
                destination=f"{destination.latitude},{destination.longitude}",
                mode=mode,
                waypoints=waypoints_formatted,
                alternatives=alternatives,
                optimize_waypoints=True if waypoints_formatted else False,
            )

            if not directions_result:
                logger.warning(
                    f"No route found for origin='{origin}', destination='{destination}', mode='{mode}'"
                )
                raise DirectionsError(f"No route found between {origin} and {destination} using mode {mode}")

            # Get the first (usually optimal) route
            route_leg = directions_result[0]
            legs = route_leg["legs"]

            segments = []
            total_distance = 0
            total_duration = 0
            path_points = []

            for leg in legs:
                # Extract detailed path points from each step
                for step in leg.get("steps", []):
                    points = polyline.decode(step["polyline"]["points"])
                    path_points.extend(points)

                # Get the last step's polyline for the segment
                last_step = leg["steps"][-1] if leg.get("steps") else {"polyline": {"points": ""}}

                segment = RouteSegment(
                    start_location=Location(
                        latitude=leg["start_location"]["lat"],
                        longitude=leg["start_location"]["lng"],
                        address=leg.get("start_address", ""),
                    ),
                    end_location=Location(
                        latitude=leg["end_location"]["lat"],
                        longitude=leg["end_location"]["lng"],
                        address=leg.get("end_address", ""),
                    ),
                    distance=float(leg["distance"]["value"]),  # Ensure float
                    duration=float(leg["duration"]["value"]) / 60,  # Convert seconds to minutes
                    polyline=last_step["polyline"]["points"],
                    instructions=[
                        step["html_instructions"] for step in leg.get("steps", [])
                    ],
                )
                segments.append(segment)
                total_distance += float(leg["distance"]["value"])
                total_duration += float(leg["duration"]["value"])

            final_route = Route(
                segments=segments,
                total_distance=float(total_distance),
                total_duration=float(total_duration) / 60,  # Convert seconds to minutes
                path_points=path_points,
                summary=route_leg.get("summary", "")
            )
            logger.info(
                f"Successfully found route for origin='{origin}', destination='{destination}', mode='{mode}': "
                f"{len(segments)} segments, distance={final_route.total_distance/1000:.1f}km, "
                f"duration={final_route.total_duration:.0f}min"
            )
            return final_route
        except googlemaps.exceptions.ApiError as e:
            logger.error(
                f"Google Maps API error while getting directions for origin='{origin}', destination='{destination}', mode='{mode}': {e}",
                exc_info=True
            )
            raise DirectionsError(f"API error while getting directions: {e}") from e
        except Exception as e:
            logger.error(
                f"Unexpected error while getting directions for origin='{origin}', destination='{destination}', mode='{mode}': {e}",
                exc_info=True
            )
            raise DirectionsError(f"Unexpected error while getting directions: {e}") from e

    async def search_places(
        self,
        query: str,
        location: Optional[Location] = None, # Using models.location.Location for consistency
        radius: Optional[int] = None, # Kept from original search_places
        filters: Optional[Dict[str, Any]] = None, # Kept from original search
    ) -> SearchResult:
        """
        Search for places using Google Maps Places API.
        Combines functionality of previous search_places and search.
        Returns a structured SearchResult.
        """
        log_query_parts = [f"query='{query}'"]
        if location:
            log_query_parts.append(f"location=({location.latitude},{location.longitude})")
        if radius:
            log_query_parts.append(f"radius={radius}m")
        if filters:
            log_query_parts.append(f"filters={filters}")
        logger.info(f"Attempting to search places with {', '.join(log_query_parts)}")

        api_location_param = None
        if location:
            # googlemaps client expects a tuple/list of (lat, lng) or a dict for location
            api_location_param = (location.latitude, location.longitude)

        # The 'radius' parameter is only valid if 'location' is also provided.
        # The 'filters' dict can contain other API specific params.
        api_params = filters or {}
        if radius and not location:
            logger.warning("Radius provided for place search without location. Radius will be ignored.")
            # Or raise PlacesSearchError("Radius for search requires a location.")

        try:
            places_results = self.client.places(
                query=query,
                location=api_location_param,
                radius=radius if location else None, # Only send radius if location is present
                **api_params,
            )

            items = []
            for place_data in places_results.get("results", []):
                # Constructing PlaceDetails from search result, similar to old 'search' method
                loc_data = place_data["geometry"]["location"]
                items.append(
                    PlaceDetails( # Using PlaceDetails for items as in the old 'search' method
                        id=place_data["place_id"],
                        name=place_data["name"],
                        location=GeoLocation( # Search results provide GeoLocation directly
                            latitude=loc_data["lat"],
                            longitude=loc_data["lng"],
                            address=place_data.get("formatted_address", place_data.get("vicinity"))
                        ),
                        rating=place_data.get("rating"),
                        photos=[
                            photo["photo_reference"] for photo in place_data.get("photos", [])
                        ],
                        # Other fields from PlaceDetails can be populated if available directly from search results
                        # or marked as Optional/defaulted in PlaceDetails model.
                        amenities=place_data.get("types", []),
                    )
                )

            logger.info(f"Successfully found {len(items)} places for {', '.join(log_query_parts)}")
            return SearchResult(
                items=items,
                total_count=len(items), # Note: Google Places API might offer total results differently, this is count of current page
                has_more="next_page_token" in places_results,
            )
        except googlemaps.exceptions.ApiError as e:
            logger.error(f"Google Maps API error during place search for {', '.join(log_query_parts)}: {e}", exc_info=True)
            raise PlacesSearchError(f"API error during place search: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error during place search for {', '.join(log_query_parts)}: {e}", exc_info=True)
            raise PlacesSearchError(f"Unexpected error during place search: {e}") from e

    async def get_place_details(self, place_id: str) -> PlaceDetails:
        """
        Get detailed information about a specific place.
        Combines functionality of previous get_place_details and get_details.
        Returns a structured PlaceDetails object.
        """
        logger.info(f"Attempting to get details for place_id: '{place_id}'")
        try:
            place_result = self.client.place(place_id=place_id) # Removed fields parameter to get all details

            if not place_result or not place_result.get("result"):
                logger.warning(f"No details found for place_id: '{place_id}'")
                raise PlaceDetailsError(f"No details found for place_id: {place_id}")

            detail_data = place_result["result"]

            # Constructing PlaceDetails from place details result, similar to old 'get_details'
            loc_data = detail_data["geometry"]["location"]
            place_details_obj = PlaceDetails(
                id=detail_data["place_id"],
                name=detail_data["name"],
                location=GeoLocation(
                    latitude=loc_data["lat"],
                    longitude=loc_data["lng"],
                    address=detail_data.get("formatted_address", detail_data.get("vicinity")),
                ),
                rating=detail_data.get("rating"),
                reviews_count=detail_data.get("user_ratings_total"),
                photos=[
                    photo["photo_reference"] for photo in detail_data.get("photos", [])
                ],
                amenities=detail_data.get("types", []),
                metadata={
                    "phone": detail_data.get("formatted_phone_number"),
                    "website": detail_data.get("website"),
                    "opening_hours": detail_data.get("opening_hours", {}).get("weekday_text", []),
                    # Add other relevant details if needed
                },
            )
            logger.info(f"Successfully retrieved details for place_id: '{place_id}'")
            return place_details_obj
        except googlemaps.exceptions.ApiError as e:
            logger.error(f"Google Maps API error while getting details for place_id '{place_id}': {e}", exc_info=True)
            raise PlaceDetailsError(f"API error retrieving details for '{place_id}': {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error while getting details for place_id '{place_id}': {e}", exc_info=True)
            raise PlaceDetailsError(f"Unexpected error retrieving details for '{place_id}': {e}") from e
