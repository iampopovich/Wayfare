from typing import List, Dict, Any, Optional
import polyline
from wayfare.models.travel import TravelRequest, TravelResponse, TransportationType
from wayfare.models.route import Route, RouteSegment
from wayfare.models.location import Location
from wayfare.models.stops import Stop
from wayfare.models.costs import Cost
from wayfare.models.health import Health
from wayfare.models.vehicle import TransportCosts
from wayfare.repositories.maps.google_maps import GoogleMapsRepository
import logging

logger = logging.getLogger(__name__)

class TravelService:
    # Google Maps supported travel modes
    TRANSPORT_MODE_MAPPING = {
        TransportationType.CAR: "driving",
        TransportationType.WALKING: "walking",
        TransportationType.BICYCLE: "bicycling",
        TransportationType.BUS: "transit",
        TransportationType.TRAIN: "transit"
    }

    # Average fuel prices by type (USD per liter)
    FUEL_PRICES = {
        "gasoline": 1.2,
        "diesel": 1.1,
        "electric": 0.15  # Price per kWh
    }

    def __init__(self, maps_repository: GoogleMapsRepository):
        self.maps_repository = maps_repository

    def _get_google_maps_mode(self, transport_type: TransportationType) -> str:
        """Convert our transport type to Google Maps travel mode."""
        mode = self.TRANSPORT_MODE_MAPPING.get(transport_type)
        if not mode:
            raise ValueError(
                f"Unsupported transportation type: {transport_type}. "
                f"Supported types are: {', '.join(self.TRANSPORT_MODE_MAPPING.keys())}"
            )
        return mode

    async def _calculate_transport_costs(
        self, 
        distance_meters: float, 
        duration_minutes: float,
        transport_type: TransportationType,
        request: TravelRequest
    ) -> TransportCosts:
        """Calculate transport costs based on mode and distance."""
        costs = TransportCosts(total_cost=0, currency="USD")
        
        # Basic food and water costs for long trips (over 2 hours)
        if duration_minutes > 120:
            costs.food_cost = 10 * (duration_minutes / 60)  # $10 per hour for food
            costs.water_cost = 2 * (duration_minutes / 60)  # $2 per hour for water
        
        # Calculate accommodation costs if overnight stay is needed (over 16 hours)
        if duration_minutes > 960:
            if request.overnight_stay and request.overnight_stay.max_price_per_night:
                costs.accommodation_cost = request.overnight_stay.max_price_per_night
            else:
                costs.accommodation_cost = 100  # Default $100 per night
        
        # Calculate transport-specific costs
        distance_km = distance_meters / 1000
        
        if transport_type == TransportationType.CAR and request.car_specifications:
            # Calculate total mass (vehicle + passengers + luggage)
            total_mass = (
                request.car_specifications.base_mass +
                (request.car_specifications.passenger_mass * request.passengers)
            )
            
            # Adjust fuel consumption based on mass (approximate 1% increase per 100kg over base mass)
            mass_difference = total_mass - request.car_specifications.base_mass
            mass_factor = 1 + (mass_difference / 100) * 0.01  # 1% per 100kg
            adjusted_consumption = request.car_specifications.fuel_consumption * mass_factor
            
            # Calculate total fuel consumption
            total_consumption = (distance_km / 100) * adjusted_consumption
            fuel_price = self.FUEL_PRICES.get(request.car_specifications.fuel_type, 1.2)
            
            costs.fuel_consumption = round(total_consumption, 2)
            costs.fuel_cost = round(total_consumption * fuel_price, 2)
            
            # Calculate refueling stops if tank capacity is provided
            if request.car_specifications.tank_capacity:
                range_per_tank = (request.car_specifications.tank_capacity / adjusted_consumption) * 100
                costs.refueling_stops = max(0, int(distance_km / range_per_tank))
            
            costs.total_cost = costs.fuel_cost
            
        elif transport_type in [TransportationType.BUS, TransportationType.TRAIN, TransportationType.PLANE]:
            # Set base ticket prices per km for different transport types
            ticket_rates = {
                TransportationType.BUS: 0.1,    # $0.1 per km
                TransportationType.TRAIN: 0.15,  # $0.15 per km
                TransportationType.PLANE: 0.5    # $0.5 per km
            }
            
            base_rate = ticket_rates[transport_type]
            costs.ticket_cost = round(distance_km * base_rate * request.passengers, 2)
            costs.total_cost = costs.ticket_cost
            
        # For walking, only include food, water, and accommodation costs
        
        # Add food, water and accommodation costs to total
        if costs.food_cost:
            costs.total_cost += costs.food_cost
        if costs.water_cost:
            costs.total_cost += costs.water_cost
        if costs.accommodation_cost:
            costs.total_cost += costs.accommodation_cost
            
        return costs

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

            # Calculate transport costs
            costs = await self._calculate_transport_costs(
                distance_meters=route.total_distance,
                duration_minutes=route.total_duration,
                transport_type=request.transportation_type,
                request=request
            )

            # Calculate health metrics
            health = Health(
                total_calories=self._calculate_calories(
                    route.total_distance,
                    request.transportation_type
                ),
                activity_breakdown={
                    request.transportation_type.value: route.total_distance * 0.1
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

    def _calculate_calories(self, distance_meters: float, transport_type: TransportationType) -> float:
        """Calculate calories burned during travel."""
        # Simple calorie calculation
        base_rate = {
            TransportationType.CAR: 0.1,     # Very low for driving
            TransportationType.BUS: 0.2,     # Slightly more for public transport
            TransportationType.TRAIN: 0.2,   # Similar to bus
            TransportationType.WALKING: 60,  # 60 calories per km
            TransportationType.BICYCLE: 40,  # 40 calories per km
        }.get(transport_type, 0.1)  # Default to car rate

        kilometers = distance_meters / 1000
        return round(base_rate * kilometers, 2)
