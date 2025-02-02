from typing import List, Dict, Any
from wayfare.models.travel import TravelRequest, TravelResponse
from wayfare.models.route import Route, RouteSegment
from wayfare.models.location import Location
from wayfare.models.stops import Stop
from wayfare.models.costs import Cost
from wayfare.models.health import Health
from wayfare.repositories.maps.google_maps import GoogleMapsRepository
import logging

logger = logging.getLogger(__name__)

class TravelService:
    # Google Maps supported travel modes: driving, walking, bicycling, transit
    TRANSPORT_MODE_MAPPING = {
        "car": "driving",
        "walking": "walking",
        "bicycle": "bicycling",
        "bus": "transit",
        "train": "transit"
    }

    def __init__(self, maps_repository: GoogleMapsRepository):
        self.maps_repository = maps_repository

    def _get_google_maps_mode(self, transport_type: str) -> str:
        """Convert our transport type to Google Maps travel mode."""
        mode = self.TRANSPORT_MODE_MAPPING.get(transport_type.lower())
        if not mode:
            raise ValueError(
                f"Unsupported transportation type: {transport_type}. "
                f"Supported types are: {', '.join(self.TRANSPORT_MODE_MAPPING.keys())}"
            )
        return mode

    async def plan_travel(self, request: TravelRequest) -> TravelResponse:
        """Plan a travel route with all necessary details using Google Maps."""
        try:
            # First, geocode the origin and destination
            logger.info(f"Geocoding locations: {request.origin} -> {request.destination}")
            
            origin_location = await self.maps_repository.geocode(request.origin)
            destination_location = await self.maps_repository.geocode(request.destination)
            
            logger.info(f"Geocoded locations: {origin_location} -> {destination_location}")

            # Convert transport type to Google Maps mode
            mode = self._get_google_maps_mode(request.transportation_type)
            logger.info(f"Using Google Maps travel mode: {mode}")

            # Get route from Google Maps
            route = await self.maps_repository.get_directions(
                origin=origin_location,
                destination=destination_location,
                mode=mode
            )

            # Calculate costs based on distance and transportation type
            costs = Cost(
                total_amount=self._estimate_travel_cost(
                    route.total_distance,
                    request.transportation_type,
                    request.passengers
                ),
                currency="USD",
                breakdown={
                    "transportation": route.total_distance * 0.1,  # Simple estimation
                    "other": 0
                }
            )

            # Calculate health metrics
            health = Health(
                total_calories=self._calculate_calories(
                    route.total_distance,
                    request.transportation_type
                ),
                activity_breakdown={
                    request.transportation_type: route.total_distance * 0.1  # Simple estimation
                }
            )

            # Find stops along the route if needed
            stops = []
            if route.total_duration > 120:  # If journey is more than 2 hours
                stops = await self._find_stops(route, request)

            return TravelResponse(
                route=route,
                stops=stops,
                costs=costs,
                health=health
            )

        except Exception as e:
            logger.error(f"Error in plan_travel: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to plan travel: {str(e)}")

    async def _find_stops(self, route: Route, request: TravelRequest) -> List[Stop]:
        """Find suitable stops along the route."""
        stops = []
        try:
            # Calculate number of stops needed
            hours = route.total_duration / 60
            num_stops = max(1, int(hours / 2))  # One stop every 2 hours

            for i in range(num_stops):
                # Get a point along the route
                segment = route.segments[int(len(route.segments) * (i + 1) / (num_stops + 1))]
                
                # Search for places near this point
                places = await self.maps_repository.search_places(
                    query="restaurant OR rest area OR gas station",
                    location=segment.start_location,
                    radius=5000  # 5km radius
                )

                if places:
                    # Take the first suitable place
                    place = places[0]
                    stops.append(Stop(
                        location=Location(
                            latitude=place["geometry"]["location"]["lat"],
                            longitude=place["geometry"]["location"]["lng"],
                            address=place.get("formatted_address", ""),
                            place_id=place["place_id"]
                        ),
                        type="rest",
                        duration=30,  # 30 minutes stop
                        facilities=place.get("types", [])
                    ))

        except Exception as e:
            logger.warning(f"Error finding stops: {str(e)}", exc_info=True)
            # Continue without stops if there's an error

        return stops

    def _estimate_travel_cost(self, distance_meters: float, transport_type: str, passengers: int) -> float:
        """Estimate travel cost based on distance and transport type."""
        # Simple cost estimation
        base_rate = {
            "car": 0.5,    # $0.5 per km
            "bus": 0.2,    # $0.2 per km
            "train": 0.3,  # $0.3 per km
            "walking": 0,  # Free
            "bicycle": 0.1 # $0.1 per km for maintenance
        }.get(transport_type.lower(), 0.5)  # Default to car rate

        kilometers = distance_meters / 1000
        return round(base_rate * kilometers * passengers, 2)

    def _calculate_calories(self, distance_meters: float, transport_type: str) -> float:
        """Calculate calories burned during travel."""
        # Simple calorie calculation
        base_rate = {
            "car": 0.1,     # Very low for driving
            "bus": 0.2,     # Slightly more for public transport
            "train": 0.2,   # Similar to bus
            "walking": 60,  # 60 calories per km
            "bicycle": 40,  # 40 calories per km
        }.get(transport_type.lower(), 0.1)  # Default to car rate

        kilometers = distance_meters / 1000
        return round(base_rate * kilometers, 2)
