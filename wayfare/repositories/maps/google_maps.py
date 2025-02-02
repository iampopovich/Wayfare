from typing import Optional, List, Dict, Any
import googlemaps
import polyline
from wayfare.models.base import GeoLocation, PlaceDetails, SearchResult
from wayfare.models.location import Location
from wayfare.models.route import Route, RouteSegment
import logging

logger = logging.getLogger(__name__)

class GoogleMapsRepository:
    def __init__(self, api_key: str):
        """Initialize Google Maps client."""
        self.client = googlemaps.Client(key=api_key)

    async def geocode(self, address: str) -> GeoLocation:
        """Convert address to coordinates using Google Maps API."""
        result = self.client.geocode(address)
        if not result:
            raise ValueError(f"No results found for address: {address}")
        
        location = result[0]['geometry']['location']
        return GeoLocation(
            latitude=location['lat'],
            longitude=location['lng'],
            address=result[0]['formatted_address']
        )

    async def reverse_geocode(self, location: GeoLocation) -> str:
        """Convert coordinates to address using Google Maps API."""
        result = self.client.reverse_geocode((location.latitude, location.longitude))
        if not result:
            raise ValueError(f"No results found for location: {location}")
        return result[0]['formatted_address']

    async def search_places(self, query: str, location: Optional[Location] = None, radius: Optional[int] = None) -> List[Dict[str, Any]]:
        """Search for places using Google Maps Places API."""
        location_bias = None
        if location and radius:
            location_bias = {
                "location": {"lat": location.latitude, "lng": location.longitude},
                "radius": radius
            }

        result = self.client.places(
            query,
            location=location_bias["location"] if location_bias else None,
            radius=radius
        )
        return result.get("results", [])

    async def get_place_details(self, place_id: str) -> Dict[str, Any]:
        """Get detailed information about a specific place."""
        result = self.client.place(place_id)
        return result.get("result", {})

    async def get_directions(
        self,
        origin: Location,
        destination: Location,
        mode: str = "driving",
        waypoints: Optional[List[Location]] = None,
        alternatives: bool = True
    ) -> Route:
        """Get directions between two points using actual roads and routes."""
        logger.info(f"Getting directions from {origin} to {destination} using mode: {mode}")
        
        waypoints_list = None
        if waypoints:
            waypoints_list = [f"{w.latitude},{w.longitude}" for w in waypoints]

        try:
            result = self.client.directions(
                origin=f"{origin.latitude},{origin.longitude}",
                destination=f"{destination.latitude},{destination.longitude}",
                mode=mode,
                waypoints=waypoints_list,
                alternatives=alternatives,  # Get alternative routes if available
                optimize_waypoints=True if waypoints else False
            )

            if not result:
                raise ValueError(f"No route found between {origin} and {destination}")

            # Get the first (usually optimal) route
            route = result[0]
            legs = route["legs"]

            segments = []
            total_distance = 0
            total_duration = 0
            path_points = []

            for leg in legs:
                # Extract detailed path points from each step
                for step in leg.get("steps", []):
                    points = polyline.decode(step["polyline"]["points"])
                    path_points.extend(points)

                segment = RouteSegment(
                    start_location=Location(
                        latitude=leg["start_location"]["lat"],
                        longitude=leg["start_location"]["lng"],
                        address=leg.get("start_address", "")
                    ),
                    end_location=Location(
                        latitude=leg["end_location"]["lat"],
                        longitude=leg["end_location"]["lng"],
                        address=leg.get("end_address", "")
                    ),
                    distance=leg["distance"]["value"],
                    duration=leg["duration"]["value"] / 60,  # Convert to minutes
                    polyline=step["polyline"]["points"],
                    instructions=[step["html_instructions"] for step in leg.get("steps", [])]
                )
                segments.append(segment)
                total_distance += leg["distance"]["value"]
                total_duration += leg["duration"]["value"]

            return Route(
                segments=segments,
                total_distance=total_distance,
                total_duration=total_duration / 60,  # Convert to minutes
                path_points=path_points
            )

        except Exception as e:
            logger.error(f"Error getting directions: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to get directions: {str(e)}")

    async def search(
        self,
        query: str,
        location: Optional[GeoLocation] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> SearchResult:
        """Search for places using Google Maps API."""
        places_results = self.client.places(
            query,
            location=(location.latitude, location.longitude) if location else None,
            **filters or {}
        )

        items = []
        for place in places_results['results']:
            items.append(PlaceDetails(
                id=place['place_id'],
                name=place['name'],
                location=GeoLocation(
                    latitude=place['geometry']['location']['lat'],
                    longitude=place['geometry']['location']['lng']
                ),
                rating=place.get('rating'),
                photos=[photo['photo_reference'] for photo in place.get('photos', [])]
            ))

        return SearchResult(
            items=items,
            total_count=len(items),
            has_more='next_page_token' in places_results
        )

    async def get_details(self, item_id: str) -> PlaceDetails:
        """Get detailed information about a specific place."""
        place = self.client.place(item_id)
        
        return PlaceDetails(
            id=place['place_id'],
            name=place['name'],
            location=GeoLocation(
                latitude=place['geometry']['location']['lat'],
                longitude=place['geometry']['location']['lng'],
                address=place.get('formatted_address')
            ),
            rating=place.get('rating'),
            reviews_count=place.get('user_ratings_total'),
            photos=[photo['photo_reference'] for photo in place.get('photos', [])],
            amenities=place.get('types', []),
            metadata={
                'phone': place.get('formatted_phone_number'),
                'website': place.get('website'),
                'opening_hours': place.get('opening_hours', {}).get('weekday_text', [])
            }
        )
